// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IMorpho, MarketParams, Position, Id} from "./interfaces/IMorpho.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IRemoteCollateralManager} from "./interfaces/IRemoteCollateralManager.sol";
import {MarketParamsLib} from "./libraries/MarketParamsLib.sol";
import {RLPReader} from "./libraries/RLPReader.sol";
import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";

/**
 * CoreVault — Attestcoin Smart Contract (ASC) on Creditcoin (CC3 102031) + Morpho facade.
 *
 * ETH → CC (trustless, permissionless): anyone submits a `CrossChainLockProof` for a SourceVault
 * `lock` tx on Sepolia (chainKey 1). The proof is verified by the Block Prover Precompile (0x0FD2
 * `verifySingle`), then the encodedTransaction (tx + receipt data) is decoded on-chain: receipt
 * status must be success and the `Locked` log emitted by SourceVault must match the proof fields.
 * The borrower's remote collateral position is then credited on the Morpho market — no token moves.
 *
 * CC → ETH (trusted worker): `requestUnlock` (after repay) and `requestLiquidationPayout` (after a
 * remote liquidation credit) emit `UnlockRequested`; the worker calls SourceVault.unlock on Sepolia.
 */
contract CoreVault is IRemoteCollateralManager, Ownable {
    using MarketParamsLib for MarketParams;
    using RLPReader for *;

    struct CrossChainLockProof {
        bytes32 lockId; // SourceVault lockId
        address sourceCollateral; // collateral token on the source chain
        uint256 amount;
        address recipient; // borrower credited on Creditcoin
        bytes32 marketId; // Morpho market id (Id.unwrap)
        uint64 headerNumber; // source chain block containing the lock tx
        bytes txBytes; // encodedTransaction: tx RLP (+ envelope byte) || receipt RLP
        bytes32 merkleRoot; // tx merkle root (block header)
        bytes32[] siblings; // merkle proof siblings
        bytes32 lowerDigest; // continuity proof lower endpoint digest
        bytes32[] roots; // continuity proof roots
    }

    IMorpho public immutable MORPHO;
    address public immutable SOURCE_VAULT;
    uint64 public immutable SOURCE_CHAIN_KEY; // 1 for Sepolia (0x0FD2 chain key)
    uint64 public immutable SOURCE_CHAIN_ID; // 11155111 (used in lockId recomputation)
    address public constant BLOCK_PROVER = address(0x0FD2);

    /// @notice keccak256("Locked(bytes32,address,address,uint256,bytes32,uint64)")
    bytes32 public constant LOCKED_TOPIC0 =
        keccak256(bytes("Locked(bytes32,address,address,uint256,bytes32,uint64)"));

    address public worker;
    bool public paused;

    /// @dev lockId => already consumed (replay protection).
    mapping(bytes32 => bool) public isProofUsed;
    /// @dev source chain collateral => Creditcoin mirror collateral token (market collateralToken).
    mapping(address => address) public sourceToCreditcoinToken;
    /// @dev Creditcoin collateral => source chain collateral (for unlock routing).
    mapping(address => address) public creditcoinToSourceToken;
    /// @dev liquidator => Creditcoin collateral token => seized collateral credit (remote markets).
    mapping(address => mapping(address => uint256)) public claims;

    event CollateralSupplied(bytes32 indexed lockId, address indexed recipient, address indexed collateralToken, uint256 amount);
    event UnlockRequested(
        address indexed recipient,
        address indexed creditcoinCollateral,
        address sourceCollateral,
        uint256 amount,
        bytes32 marketId
    );
    event ClaimCredited(address indexed liquidator, address indexed collateralToken, uint256 amount);
    event WorkerUpdated(address indexed worker);
    event PausedSet(bool paused);
    event SourceTokenMappingSet(address indexed sourceToken, address indexed creditcoinToken);

    modifier onlyWorkerOrOwner() {
        require(msg.sender == worker || msg.sender == owner(), "only worker/owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "paused");
        _;
    }

    constructor(address morpho_, address sourceVault_, uint64 sourceChainKey_, uint64 sourceChainId_, address worker_) {
        require(morpho_ != address(0) && sourceVault_ != address(0), "zero address");
        require(worker_ != address(0), "worker zero");
        MORPHO = IMorpho(morpho_);
        SOURCE_VAULT = sourceVault_;
        SOURCE_CHAIN_KEY = sourceChainKey_;
        SOURCE_CHAIN_ID = sourceChainId_;
        worker = worker_;
        emit WorkerUpdated(worker_);
    }

    /* ADMIN */

    function setWorker(address newWorker) external onlyOwner {
        require(newWorker != address(0), "worker zero");
        worker = newWorker;
        emit WorkerUpdated(newWorker);
    }

    /// @notice Pause blocks new proofs, borrows and unlock requests. Repay and supplier withdrawals
    ///         stay open so users can always exit.
    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PausedSet(p);
    }

    function setSourceTokenMapping(address sourceToken, address creditcoinToken) external onlyOwner {
        require(sourceToken != address(0) && creditcoinToken != address(0), "zero address");
        sourceToCreditcoinToken[sourceToken] = creditcoinToken;
        creditcoinToSourceToken[creditcoinToken] = sourceToken;
        emit SourceTokenMappingSet(sourceToken, creditcoinToken);
    }

    /* TRUSTLESS PROOF SUBMISSION (ETH → CC) */

    /**
     * @notice Verifies a SourceVault `lock` tx proof and credits the borrower's remote collateral.
     * @param p The cross-chain lock proof (proof + encoded transaction bytes).
     * @param mp The Morpho market params; its id must equal the lock's market id.
     */
    function verifyAndSupplyCollateral(CrossChainLockProof calldata p, MarketParams calldata mp)
        external
        whenNotPaused
    {
        require(!isProofUsed[p.lockId], "proof used");
        require(mp.collateralToken == sourceToCreditcoinToken[p.sourceCollateral], "collateral mismatch");
        require(Id.unwrap(mp.id()) == p.marketId, "market mismatch");

        // 1. Verify tx inclusion + continuity via the Block Prover Precompile (skipped on anvil).
        if (block.chainid != 31337 && BLOCK_PROVER.code.length > 0) {
            (bool ok, bytes memory ret) = BLOCK_PROVER.staticcall(
                abi.encodeWithSignature(
                    "verifySingle(uint64,uint64,bytes,bytes32,bytes32[],bytes32,bytes32[])",
                    SOURCE_CHAIN_KEY,
                    p.headerNumber,
                    p.txBytes,
                    p.merkleRoot,
                    p.siblings,
                    p.lowerDigest,
                    p.roots
                )
            );
            require(ok && ret.length == 32 && abi.decode(ret, (bool)), "tx proof verify failed");
        }

        // 2. Decode the verified encodedTransaction and bind it to the proof fields.
        uint256 amount = _decodeLockedLog(p);

        // 3. Credit the remote collateral position. No token transfer: the RWA stays escrowed on Sepolia.
        isProofUsed[p.lockId] = true;
        MORPHO.supplyRemoteCollateral(mp, p.lockId, amount, p.recipient);

        emit CollateralSupplied(p.lockId, p.recipient, mp.collateralToken, amount);
    }

    /// @notice Decodes the `Locked` log from the verified encodedTransaction and validates all proof fields.
    function _decodeLockedLog(CrossChainLockProof calldata p) internal view returns (uint256 amount) {
        bytes memory data = p.txBytes;

        // Typed transaction envelope (EIP-2718): 0x01 (2930) or 0x02 (1559) prefix byte.
        uint256 start;
        uint256 firstByte;
        assembly ("memory-safe") {
            firstByte := byte(0, mload(add(data, 32)))
        }
        if (firstByte == 0x01 || firstByte == 0x02) start = 1;

        // Layout: txItem || receiptItem (Attestcoin encodedTransaction = transaction + receipt data).
        RLPReader.RLPItem memory txItem = RLPReader.next(data, start);
        require(start + txItem.total < data.length, "receipt missing");

        RLPReader.RLPItem memory receipt = RLPReader.next(data, start + txItem.total);
        require(receipt.isList, "RLP: receipt not a list");

        // Post-byzantium receipt: [status, cumulativeGasUsed, logsBloom, logs]
        require(receipt.itemAt(data, 0).toUint(data) == 1, "tx failed");

        RLPReader.RLPItem memory logs = receipt.itemAt(data, 3);
        require(logs.isList, "RLP: logs not a list");

        uint256 ptr = logs.memPtr;
        uint256 logsEnd = logs.memPtr + logs.len;
        while (ptr < logsEnd) {
            RLPReader.RLPItem memory logItem = RLPReader.next(data, ptr);
            ptr += logItem.total;
            if (!logItem.isList) continue;

            // log entry: [logger address, topics list, data bytes]
            address logger = logItem.itemAt(data, 0).toAddress(data);
            if (logger != SOURCE_VAULT) continue;

            RLPReader.RLPItem memory topics = logItem.itemAt(data, 1);
            if (!topics.isList || _countItems(topics, data) < 4) continue;
            if (topics.itemAt(data, 0).toBytes32(data) != LOCKED_TOPIC0) continue;

            bytes32 lockId = topics.itemAt(data, 1).toBytes32(data);
            // topics are 32-byte strings; addresses sit in the low 20 bytes
            address recipient = address(uint160(uint256(topics.itemAt(data, 2).toBytes32(data))));
            address collateralToken = address(uint160(uint256(topics.itemAt(data, 3).toBytes32(data))));

            bytes memory logData = logItem.itemAt(data, 2).toBytes(data);
            require(logData.length == 96, "bad log data");

            uint256 logAmount;
            bytes32 logMarketId;
            uint64 logNonce;
            assembly ("memory-safe") {
                logAmount := mload(add(logData, 32))
                logMarketId := mload(add(logData, 64))
                // uint64 sits in the LOW 8 bytes of the ABI word
                logNonce := and(mload(add(logData, 96)), 0xFFFFFFFFFFFFFFFF)
            }

            require(lockId == p.lockId, "lockId mismatch");
            require(recipient == p.recipient, "recipient mismatch");
            require(collateralToken == p.sourceCollateral, "collateral mismatch");
            require(logAmount == p.amount, "amount mismatch");
            require(logMarketId == p.marketId, "marketId mismatch");

            // Full binding: recompute the lockId exactly as SourceVault does.
            bytes32 recomputed =
                keccak256(abi.encode(SOURCE_CHAIN_ID, collateralToken, recipient, logAmount, logMarketId, logNonce));
            require(recomputed == p.lockId, "lockId recompute mismatch");

            return logAmount;
        }
        revert("Locked log not found");
    }

    /// @notice Counts the sub-items of an RLP list (leading-zero trimming makes payload length unreliable).
    function _countItems(RLPReader.RLPItem memory list, bytes memory data) internal pure returns (uint256 count) {
        uint256 ptr = list.memPtr;
        uint256 end = list.memPtr + list.len;
        while (ptr < end) {
            ptr += RLPReader.next(data, ptr).total;
            count++;
        }
    }

    /* REMOTE LIQUIDATION SETTLEMENT (called by Morpho) */

    function onRemoteSeized(Id id, address borrower, address liquidator, uint256 assets) external {
        require(msg.sender == address(MORPHO), "only morpho");
        borrower; // positions already debited by Morpho; only the claim matters here
        address collateralToken = MORPHO.idToMarketParams(id).collateralToken;
        claims[liquidator][collateralToken] += assets;
        emit ClaimCredited(liquidator, collateralToken, assets);
    }

    /* MORPHO FACADE (all local on Creditcoin) */

    /// @notice Approves MORPHO to spend `amount` of `token` from CoreVault (Morpho pulls from us).
    function _approveMorpho(address token, uint256 amount) internal {
        (bool ok,) = token.call(abi.encodeWithSelector(0x095ea7b3, address(MORPHO), amount)); // approve(address,uint256)
        require(ok, "approve failed");
    }

    /// @notice Supplies loan tokens (e.g. USDC). Anyone may supply on behalf of others.
    /// @dev Pulls the loan tokens from the caller first (Morpho pulls from CoreVault as its caller).
    function supply(MarketParams memory mp, uint256 assets, uint256 shares, address onBehalf)
        external
        returns (uint256, uint256)
    {
        if (assets > 0) {
            SafeTransferLib.safeTransferFrom(IERC20(mp.loanToken), msg.sender, address(this), assets);
            _approveMorpho(mp.loanToken, assets);
        }
        return MORPHO.supply(mp, assets, shares, onBehalf, "");
    }

    /// @notice Borrows against remote collateral. onBehalf is always the caller.
    function borrow(MarketParams memory mp, uint256 assets, address receiver) external whenNotPaused returns (uint256, uint256) {
        return MORPHO.borrow(mp, assets, 0, msg.sender, receiver);
    }

    /// @notice Withdraws the caller's own supply.
    function withdraw(MarketParams memory mp, uint256 assets, uint256 shares, address receiver)
        external
        returns (uint256, uint256)
    {
        return MORPHO.withdraw(mp, assets, shares, msg.sender, receiver);
    }

    /// @notice Repays loan tokens on behalf of `onBehalf`.
    /// @dev Pulls the loan tokens from the caller first.
    function repay(MarketParams memory mp, uint256 assets, uint256 shares, address onBehalf)
        external
        returns (uint256, uint256)
    {
        if (assets > 0) {
            SafeTransferLib.safeTransferFrom(IERC20(mp.loanToken), msg.sender, address(this), assets);
            _approveMorpho(mp.loanToken, assets);
        }
        return MORPHO.repay(mp, assets, shares, onBehalf, "");
    }

    function position(Id id, address user) external view returns (Position memory) {
        return MORPHO.position(id, user);
    }

    function market(Id id) external view returns (MarketParams memory) {
        return MORPHO.idToMarketParams(id);
    }

    /* UNLOCK REQUESTS (CC → ETH, trusted worker settles) */

    /// @notice Requests unlocking real collateral on the source chain after repaying. Decrements the
    ///         remote position first (health-checked by Morpho).
    function requestUnlock(MarketParams memory mp, uint256 amount) external whenNotPaused {
        require(amount != 0, "amount zero");
        Id id = mp.id();
        Position memory pos = MORPHO.position(id, msg.sender);
        require(pos.collateral >= amount, "insufficient collateral");

        MORPHO.withdrawRemoteCollateral(mp, amount, msg.sender);

        emit UnlockRequested(msg.sender, mp.collateralToken, creditcoinToSourceToken[mp.collateralToken], amount, Id.unwrap(id));
    }

    /// @notice Requests the real collateral payout for a liquidator's remote-seizure claim.
    function requestLiquidationPayout(address creditcoinCollateral, uint256 amount) external whenNotPaused {
        require(amount != 0, "amount zero");
        uint256 claim = claims[msg.sender][creditcoinCollateral];
        require(claim >= amount, "insufficient claim");

        claims[msg.sender][creditcoinCollateral] = claim - amount;

        emit UnlockRequested(
            msg.sender, creditcoinCollateral, creditcoinToSourceToken[creditcoinCollateral], amount, bytes32(0)
        );
    }
}
