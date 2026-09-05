// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {GOPass} from "../src/GOPass.sol";
import {GOPassRegistry} from "../src/GOPassRegistry.sol";
import {GToken} from "../src/GToken.sol";
import {RlpProof} from "./helpers/RlpProof.sol";

contract GOPassTest is Test {
    GOPass hub;
    GOPassRegistry registry;
    GToken gtoken;

    bytes32 constant PASS_MINTED_TOPIC0 = keccak256(bytes("PassMinted(address,uint256,bytes32,uint64)"));

    address owner = address(0xA11CE);
    address alice = address(0x2c1A);
    address bob = address(0xB0B0);
    address stranger = address(0xBAD);

    function setUp() public {
        vm.prank(owner);
        hub = new GOPass("https://attestgo.test/pass/");
        registry = new GOPassRegistry(address(hub), 1);
        GOPass.Rule memory baseRule = GOPass.Rule({
            allowed_group: bytes2(0),
            allowed_sub_group: bytes2(0),
            min_tier: 10,
            min_sub_tier: 0,
            is_black_list: false,
            countriesBitmap: uint256(1) << 0 | uint256(1) << 1
        });
        gtoken = new GToken("USD T-Bill", "USD-TBILL", address(hub), GToken.Rule(baseRule.allowed_group, baseRule.allowed_sub_group, baseRule.min_tier, baseRule.min_sub_tier, baseRule.is_black_list, baseRule.countriesBitmap), "https://icons.test/usd-tbill.svg", address(0));
        gtoken.transferOwnership(owner);
        vm.prank(owner);
        hub.setWorker(owner);
    }

    function _rec(uint8 tier, uint256 bitmap, uint64 expiry, bool frozen, bytes32 cid) internal pure returns (GOPass.Record memory) {
        return GOPass.Record({tier: tier, subTier: 0, group: 0, subGroup: 0, countryBitmap: bitmap, expiry: expiry, frozen: frozen, active: false, customerIdHash: cid, kycSource: ""});
    }

    function _regRec(uint8 tier, uint256 bitmap, uint64 expiry, bool frozen, bytes32 cid) internal pure returns (GOPassRegistry.Record memory) {
        return GOPassRegistry.Record({tier: tier, subTier: 0, group: 0, subGroup: 0, countryBitmap: bitmap, expiry: expiry, frozen: frozen, active: false, customerIdHash: cid, kycSource: ""});
    }

    function test_mint_pending_not_eligible() public {
        uint64 exp = uint64(block.timestamp + 365 days);
        vm.prank(owner);
        hub.mint(alice, _rec(10, 1, exp, false, keccak256("cust1")));
        assertEq(hub.ownerOf(uint160(alice)), alice);
        assertFalse(hub.getRecord(alice).active);
        GOPass.Rule memory rule = GOPass.Rule(bytes2(0), bytes2(0), 10, 0, false, 1);
        assertFalse(hub.isEligible(alice, rule));
        vm.prank(owner);
        hub.setActive(alice, true);
        assertTrue(hub.isEligible(alice, rule));
    }

    function test_mint_reverts() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.prank(stranger);
        vm.expectRevert();
        hub.mint(alice, _rec(10, 1, exp, false, keccak256("c1")));
        vm.prank(owner);
        hub.mint(alice, _rec(10, 1, exp, false, keccak256("c1")));
        vm.prank(owner);
        vm.expectRevert(bytes("already minted"));
        hub.mint(alice, _rec(10, 1, exp, false, keccak256("c1")));
        vm.prank(owner);
        vm.expectRevert(bytes("customerId used"));
        hub.mint(bob, _rec(10, 1, exp, false, keccak256("c1")));
    }

    function test_soulbound() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.prank(owner);
        hub.mint(alice, _rec(10, 1, exp, false, keccak256("c1")));
        vm.prank(alice);
        vm.expectRevert(bytes("soulbound: non-transferable"));
        hub.transferFrom(alice, bob, uint160(alice));
    }

    function test_update_and_freeze_and_active() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.prank(owner);
        hub.mint(alice, _rec(10, 1, exp, false, keccak256("c1")));
        vm.prank(owner);
        hub.setActive(alice, true);
        assertTrue(hub.getRecord(alice).active);
        vm.prank(owner);
        hub.setFrozen(alice, true);
        assertTrue(hub.getRecord(alice).frozen);
        GOPass.Rule memory rule = GOPass.Rule(bytes2(0), bytes2(0), 10, 0, false, 1);
        assertFalse(hub.isEligible(alice, rule));
    }

    function test_burn() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.prank(owner);
        hub.mint(alice, _rec(10, 1, exp, false, keccak256("c1")));
        vm.prank(owner);
        hub.burn(alice);
        assertFalse(hub.hasPass(alice));
    }

    function test_registry_sync() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        GOPassRegistry.Record memory r = _regRec(10, 1, exp, false, keccak256("c1"));
        registry.syncPass(alice, r, hex"01"); // worker/owner fallback path
        GOPassRegistry.Rule memory rule = GOPassRegistry.Rule(bytes2(0), bytes2(0), 10, 0, false, 1);
        assertTrue(registry.isEligible(alice, rule));
        rule.min_tier = 11;
        assertFalse(registry.isEligible(alice, rule));
    }

    function test_registry_sync_not_worker_reverts() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        GOPassRegistry.Record memory r = _regRec(10, 1, exp, false, keccak256("c1"));
        vm.prank(stranger);
        vm.expectRevert(bytes("only worker/owner"));
        registry.syncPass(alice, r, hex"01");
    }

    /// @notice Mints on the hub (recording the real event) and builds the tx proof for the registry.
    function _mintAndProof(uint8 tier, address to, uint64 exp, uint8 status)
        internal
        returns (GOPassRegistry.Record memory r, bytes memory txBytes)
    {
        r = _regRec(tier, 1, exp, false, keccak256("c1"));
        vm.recordLogs();
        vm.prank(owner);
        hub.mint(to, _rec(tier, 1, exp, false, keccak256("c1")));
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32[] memory topics;
        bytes memory logData;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(hub) && logs[i].topics[0] == PASS_MINTED_TOPIC0) {
                topics = logs[i].topics;
                logData = logs[i].data;
            }
        }
        require(topics.length == 3, "PassMinted not recorded");
        txBytes = RlpProof.buildEncodedTransaction(address(hub), topics, logData, status);
    }

    function _one(bytes32 v) internal pure returns (bytes32[] memory a) {
        a = new bytes32[](1);
        a[0] = v;
    }

    function test_registry_sync_with_tx_proof() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        (GOPassRegistry.Record memory r, bytes memory txBytes) = _mintAndProof(10, alice, exp, 1);
        registry.syncPassWithTxProof(alice, r, 100, txBytes, bytes32(uint256(1)), _one(bytes32(0)), bytes32(uint256(2)), _one(bytes32(0)));
        GOPassRegistry.Rule memory rule = GOPassRegistry.Rule(bytes2(0), bytes2(0), 10, 0, false, 1);
        assertTrue(registry.isEligible(alice, rule));
        assertEq(registry.verifiedUntil(alice), uint64(block.timestamp) + 24 hours);
    }

    function test_registry_tx_proof_permissionless() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        (GOPassRegistry.Record memory r, bytes memory txBytes) = _mintAndProof(10, alice, exp, 1);
        vm.prank(stranger); // anyone can submit — record is cryptographically bound to the tx
        registry.syncPassWithTxProof(alice, r, 100, txBytes, bytes32(uint256(1)), _one(bytes32(0)), bytes32(uint256(2)), _one(bytes32(0)));
        assertTrue(registry.isVerified(alice));
    }

    function test_registry_tx_proof_tampered_record_reverts() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        (GOPassRegistry.Record memory r, bytes memory txBytes) = _mintAndProof(10, alice, exp, 1);
        r.tier = 99; // fabricated record: hash no longer matches the proven PassMinted log
        vm.expectRevert(bytes("recordHash mismatch"));
        registry.syncPassWithTxProof(alice, r, 100, txBytes, bytes32(uint256(1)), _one(bytes32(0)), bytes32(uint256(2)), _one(bytes32(0)));
    }

    function test_registry_tx_proof_wrong_wallet_reverts() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        (GOPassRegistry.Record memory r, bytes memory txBytes) = _mintAndProof(10, alice, exp, 1);
        vm.expectRevert(bytes("wallet mismatch"));
        registry.syncPassWithTxProof(bob, r, 100, txBytes, bytes32(uint256(1)), _one(bytes32(0)), bytes32(uint256(2)), _one(bytes32(0)));
    }

    function test_registry_tx_proof_failed_tx_reverts() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        // receipt status = 0: a reverted mint emits no PassMinted log — nothing to decode
        (GOPassRegistry.Record memory r, bytes memory txBytes) = _mintAndProof(10, alice, exp, 0);
        vm.expectRevert(bytes("PassMinted not found"));
        registry.syncPassWithTxProof(alice, r, 100, txBytes, bytes32(uint256(1)), _one(bytes32(0)), bytes32(uint256(2)), _one(bytes32(0)));
    }

    function test_registry_tx_proof_reverted_record_reverts() public {
        // any tampering (expiry included) breaks the record hash — caught by the hash check first;
        // the explicit expiry check is belt-and-braces
        uint64 exp = uint64(block.timestamp + 1 days);
        (GOPassRegistry.Record memory r, bytes memory txBytes) = _mintAndProof(10, alice, exp, 1);
        r.expiry = uint64(exp + 1);
        vm.expectRevert(bytes("recordHash mismatch"));
        registry.syncPassWithTxProof(alice, r, 100, txBytes, bytes32(uint256(1)), _one(bytes32(0)), bytes32(uint256(2)), _one(bytes32(0)));
    }

    function test_gtoken_gated_by_active() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.prank(owner);
        hub.mint(alice, _rec(10, 1, exp, false, keccak256("c1")));
        vm.prank(owner);
        vm.expectRevert(bytes("PassNotEligible"));
        gtoken.mint(alice, 100 ether);
        vm.prank(owner);
        hub.setActive(alice, true);
        vm.prank(owner);
        gtoken.mint(alice, 100 ether);
        assertEq(gtoken.balanceOf(alice), 100 ether);
    }
}
