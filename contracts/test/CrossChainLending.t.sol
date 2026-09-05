// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {Morpho} from "../src/Morpho.sol";
import {CoreVault} from "../src/CoreVault.sol";
import {SourceVault} from "../src/SourceVault.sol";
import {MarketParams, Id} from "../src/interfaces/IMorpho.sol";
import {MarketParamsLib} from "../src/libraries/MarketParamsLib.sol";
import {ErrorsLib} from "../src/libraries/ErrorsLib.sol";
import {OracleMock} from "../src/mocks/OracleMock.sol";
import {ERC20Mock} from "../src/mocks/ERC20Mock.sol";
import {RlpProof} from "./helpers/RlpProof.sol";

contract CrossChainLendingTest is Test {
    using MarketParamsLib for MarketParams;

    // Mirror of CoreVault.UnlockRequested (solidity 0.8.19 has no qualified event emit)
    event UnlockRequested(
        address indexed recipient,
        address indexed creditcoinCollateral,
        address sourceCollateral,
        uint256 amount,
        bytes32 marketId
    );

    Morpho internal morpho;
    CoreVault internal coreVault;
    SourceVault internal sourceVault;
    OracleMock internal oracle;
    ERC20Mock internal usdc;
    ERC20Mock internal rwa;

    MarketParams internal mp;
    Id internal id;

    address internal worker = address(0x1000);
    address internal supplier = address(0x2000);
    address internal borrower = address(0x3000);
    address internal liquidator = address(0x4000);
    address internal stranger = address(0x5000);

    uint256 internal constant LLTV = 0.62e18;
    // 1 RWA raw unit = 1 USDC raw unit: price = 1e6 * 1e36 / 1e18 = 1e24 (ORACLE_PRICE_SCALE = 1e36).
    uint256 internal constant PRICE = 1e24;
    uint256 internal constant COLL = 10e18; // 10 RWA
    uint256 internal constant BORROW = 6e6; // 6 USDC < 62% of 10

    bytes32 internal t0 = keccak256(bytes("Locked(bytes32,address,address,uint256,bytes32,uint64)"));

    function setUp() public {
        morpho = new Morpho(address(this));
        oracle = new OracleMock();
        oracle.setPrice(PRICE);
        usdc = new ERC20Mock("USDC", "USDC", 6);
        rwa = new ERC20Mock("RWA", "RWA", 18);

        morpho.enableIrm(address(0)); // zero IRM = 0% borrow rate (deterministic tests)
        morpho.enableLltv(LLTV);
        mp = MarketParams({loanToken: address(usdc), collateralToken: address(rwa), oracle: address(oracle), irm: address(0), lltv: LLTV});
        morpho.createMarket(mp);
        id = mp.id();

        sourceVault = new SourceVault(worker);
        coreVault = new CoreVault(address(morpho), address(sourceVault), 1, uint64(block.chainid), worker);
        morpho.setRemoteCollateralManager(address(coreVault));
        coreVault.setSourceTokenMapping(address(rwa), address(rwa));

        usdc.setBalance(supplier, 1000e6);
        usdc.setBalance(liquidator, 100e6);
        usdc.setBalance(borrower, 100e6);
        rwa.setBalance(borrower, 100e18);

        vm.prank(supplier);
        usdc.approve(address(coreVault), type(uint256).max);
        vm.prank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);
        vm.prank(borrower);
        usdc.approve(address(coreVault), type(uint256).max);
        vm.prank(borrower);
        rwa.approve(address(sourceVault), type(uint256).max);
        // one-time per-user authorization: CoreVault manages the user's Morpho position (facade pattern)
        vm.prank(borrower);
        morpho.setAuthorization(address(coreVault), true);

        vm.prank(supplier);
        coreVault.supply(mp, 100e6, 0, supplier);
    }

    /* ---------- helper: ProofBuilder stand-in (ABI-encoded encodedTransaction) ---------- */

    /// @notice Builds an encodedTransaction in the Attestcoin ProofBuilder ABI layout with a
    ///         single `Locked` log (see test/helpers/RlpProof.sol).
    function _buildTxBytes(
        address emitter,
        bytes32[] memory topics,
        bytes memory logData
    ) internal pure returns (bytes memory) {
        return RlpProof.buildEncodedTransaction(emitter, topics, logData, 1);
    }

    /// @notice Locks on SourceVault (recording the real event) and builds the cross-chain proof.
    function _lockAndBuildProof(uint256 amount) internal returns (CoreVault.CrossChainLockProof memory p) {
        uint256 nonce = sourceVault.nonce(); // read before prank (prank applies to the next call only)
        vm.recordLogs();
        vm.prank(borrower);
        sourceVault.lock(borrower, address(rwa), amount, Id.unwrap(id), nonce);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32[] memory topics = new bytes32[](4);
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(sourceVault) && logs[i].topics[0] == t0) {
                topics[0] = logs[i].topics[0];
                topics[1] = logs[i].topics[1]; // lockId
                topics[2] = logs[i].topics[2]; // recipient
                topics[3] = logs[i].topics[3]; // collateralToken
                p = CoreVault.CrossChainLockProof({
                    lockId: topics[1],
                    sourceCollateral: address(uint160(uint256(topics[3]))),
                    amount: amount,
                    recipient: borrower,
                    marketId: Id.unwrap(id),
                    headerNumber: 12345,
                    txBytes: _buildTxBytes(address(sourceVault), topics, logs[i].data),
                    merkleRoot: bytes32(uint256(1)),
                    siblings: new bytes32[](1),
                    lowerDigest: bytes32(uint256(2)),
                    roots: new bytes32[](1)
                });
                return p;
            }
        }
        revert("Locked event not recorded");
    }

    /* ---------- tests ---------- */

    function test_lock_escrows() public {
        uint256 before = rwa.balanceOf(address(sourceVault));
        vm.prank(borrower);
        sourceVault.lock(borrower, address(rwa), COLL, Id.unwrap(id), 0);
        assertEq(rwa.balanceOf(address(sourceVault)) - before, COLL);
        assertEq(sourceVault.lockedTotal(borrower, address(rwa)), COLL);
        assertEq(sourceVault.available(borrower, address(rwa)), COLL);
    }

    function test_lock_nonce_mismatch_reverts() public {
        vm.prank(borrower);
        vm.expectRevert(bytes("nonce mismatch"));
        sourceVault.lock(borrower, address(rwa), COLL, Id.unwrap(id), 1);
    }

    function test_verify_supply_credits_position() public {
        CoreVault.CrossChainLockProof memory p = _lockAndBuildProof(COLL);
        vm.prank(stranger); // permissionless submission
        coreVault.verifyAndSupplyCollateral(p, mp);
        (, , uint128 collateral) = morpho.position(id, borrower);
        assertEq(collateral, COLL);
        assertTrue(morpho.isRemoteMarket(id));
        assertTrue(coreVault.isProofUsed(p.lockId));
    }

    function test_proof_replay_reverts() public {
        CoreVault.CrossChainLockProof memory p = _lockAndBuildProof(COLL);
        coreVault.verifyAndSupplyCollateral(p, mp);
        vm.expectRevert(bytes("proof used"));
        coreVault.verifyAndSupplyCollateral(p, mp);
    }

    function test_verify_second_lock_nonce_one() public {
        // regression: decoder must read the uint64 nonce from the low ABI bytes (non-zero here)
        vm.prank(borrower);
        sourceVault.lock(borrower, address(rwa), 4e18, Id.unwrap(id), 0);
        CoreVault.CrossChainLockProof memory p = _lockAndBuildProof(6e18);
        coreVault.verifyAndSupplyCollateral(p, mp);
        (, , uint128 collateral) = morpho.position(id, borrower);
        assertEq(collateral, 6e18);
    }

    function test_supply_usdc() public {
        (uint128 totalSupplyAssets, , , , , ) = morpho.market(id);
        assertEq(totalSupplyAssets, 100e6);
    }

    function test_borrow_healthy_and_collateral_never_moves() public {
        CoreVault.CrossChainLockProof memory p = _lockAndBuildProof(COLL);
        coreVault.verifyAndSupplyCollateral(p, mp);

        uint256 rwaBefore = rwa.balanceOf(address(morpho)) + rwa.balanceOf(address(coreVault));
        vm.prank(borrower);
        coreVault.borrow(mp, BORROW, borrower);
        assertEq(usdc.balanceOf(borrower), 100e6 + BORROW);
        // No collateral token ever moves on Creditcoin.
        assertEq(rwa.balanceOf(address(morpho)) + rwa.balanceOf(address(coreVault)), rwaBefore);
    }

    function test_borrow_unhealthy_reverts() public {
        CoreVault.CrossChainLockProof memory p = _lockAndBuildProof(COLL);
        coreVault.verifyAndSupplyCollateral(p, mp);
        vm.prank(borrower);
        vm.expectRevert(bytes(ErrorsLib.INSUFFICIENT_COLLATERAL));
        // maxBorrow = 10 × $1 / 0.62 = 16.129 USDC; anything above reverts
        coreVault.borrow(mp, (COLL * PRICE / 1e36) * 1e18 / LLTV + 1, borrower);
    }

    function test_borrow_at_lltv_boundary() public {
        CoreVault.CrossChainLockProof memory p = _lockAndBuildProof(COLL);
        coreVault.verifyAndSupplyCollateral(p, mp);
        // exactly maxBorrow = collateral value / lltv = 16.129032 USDC must be borrowable
        // (regression: upstream kilolend _isHealthy multiplied by lltv, clamping LTV to lltv^2)
        uint256 maxBorrow = (COLL * PRICE / 1e36) * 1e18 / LLTV;
        assertEq(maxBorrow, 16129032);
        vm.prank(borrower);
        coreVault.borrow(mp, maxBorrow, borrower);
    }

    function test_repay_then_request_unlock() public {
        CoreVault.CrossChainLockProof memory p = _lockAndBuildProof(COLL);
        coreVault.verifyAndSupplyCollateral(p, mp);

        vm.prank(borrower);
        coreVault.borrow(mp, BORROW, borrower);

        vm.prank(borrower);
        coreVault.repay(mp, BORROW, 0, borrower);
        (, uint128 borrowShares, uint128 collateral) = morpho.position(id, borrower);
        assertEq(borrowShares, 0);
        assertEq(collateral, COLL);

        vm.expectEmit(true, true, true, true, address(coreVault));
        emit UnlockRequested(borrower, address(rwa), address(rwa), COLL, Id.unwrap(id));
        vm.prank(borrower);
        coreVault.requestUnlock(mp, COLL);
        (, , uint128 collateralAfter) = morpho.position(id, borrower);
        assertEq(collateralAfter, 0);
    }

    function test_liquidate_credits_claim_no_token_transfer() public {
        CoreVault.CrossChainLockProof memory p = _lockAndBuildProof(COLL);
        coreVault.verifyAndSupplyCollateral(p, mp);

        vm.prank(borrower);
        coreVault.borrow(mp, BORROW, borrower);

        oracle.setPrice(3e23); // $0.3 → maxBorrow = 4.83e6 < 6e6 → unhealthy

        uint256 rwaBalBefore = rwa.balanceOf(liquidator);
        vm.prank(liquidator);
        (, uint256 repaidAssets) = morpho.liquidate(mp, borrower, 5e18, 0, "");
        assertGt(repaidAssets, 0);
        assertEq(rwa.balanceOf(liquidator) - rwaBalBefore, 0); // remote: no token transfer
        assertEq(coreVault.claims(liquidator, address(rwa)), 5e18);

        (, , uint128 collateralLeft) = morpho.position(id, borrower);
        assertEq(collateralLeft, 5e18);

        vm.prank(liquidator);
        coreVault.requestLiquidationPayout(address(rwa), 5e18);
        assertEq(coreVault.claims(liquidator, address(rwa)), 0);
    }

    function test_worker_unlock_fifo_and_access() public {
        vm.prank(borrower);
        sourceVault.lock(borrower, address(rwa), 6e18, Id.unwrap(id), 0);
        vm.prank(borrower);
        sourceVault.lock(borrower, address(rwa), 4e18, Id.unwrap(id), 1);

        vm.prank(worker);
        sourceVault.unlock(borrower, address(rwa), 7e18);
        assertEq(sourceVault.available(borrower, address(rwa)), 3e18);
        assertEq(rwa.balanceOf(borrower), 100e18 - 10e18 + 7e18);

        // over-unlock reverts
        vm.prank(worker);
        vm.expectRevert(bytes("insufficient locked"));
        sourceVault.unlock(borrower, address(rwa), 4e18);

        // only worker/owner
        vm.prank(stranger);
        vm.expectRevert(bytes("only worker/owner"));
        sourceVault.unlock(borrower, address(rwa), 1e18);

        // owner is backup
        sourceVault.unlock(borrower, address(rwa), 3e18);
        assertEq(sourceVault.available(borrower, address(rwa)), 0);
    }

    function test_access_controls_and_pause() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("only morpho"));
        coreVault.onRemoteSeized(id, borrower, liquidator, 1e18);

        vm.prank(stranger);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        coreVault.setPaused(true);

        // full borrow setup, then pause: repay must stay open
        CoreVault.CrossChainLockProof memory p = _lockAndBuildProof(COLL);
        coreVault.verifyAndSupplyCollateral(p, mp);
        vm.prank(borrower);
        coreVault.borrow(mp, BORROW, borrower);

        coreVault.setPaused(true);
        vm.expectRevert(bytes("paused"));
        coreVault.verifyAndSupplyCollateral(p, mp);
        vm.expectRevert(bytes("paused"));
        vm.prank(borrower);
        coreVault.borrow(mp, BORROW, borrower);
        // repay stays open while paused
        vm.prank(borrower);
        coreVault.repay(mp, BORROW, 0, borrower);
        (, uint128 borrowSharesAfter, ) = morpho.position(id, borrower);
        assertEq(borrowSharesAfter, 0);
    }

    function test_request_unlock_insufficient_reverts() public {
        vm.prank(borrower);
        vm.expectRevert(bytes("insufficient collateral"));
        coreVault.requestUnlock(mp, 1);
    }
}
