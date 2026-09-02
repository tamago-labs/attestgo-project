// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {RLPReader} from "./libraries/RLPReader.sol";

/**
 * GOPassRegistry — Attestcoin Smart Contract on Creditcoin (102031) for the Sepolia GOPass hub
 * (11155111, chainKey 1).
 * Sepolia GOPass mints pending (active=false); this registry verifies the mint tx inclusion via
 * 0x0FD2 `verifySingle` (trustless), then decodes the verified encodedTransaction on-chain
 * (Attestcoin Phase 4: receipt status == success + `PassMinted` log emitted by GOPASS_ADDR with
 * recordHash == keccak256(abi.encode(r))) before storing the record. Single source of truth on
 * Creditcoin; the worker then calls Sepolia GOPass.setActive(true) to activate. No privileged
 * worker needed for the trustless sync path.
 */
interface IBlockProver {
    // Creditcoin CC3 precompile 0x0FD2 — view verify. Exact signature varies by network fork;
    // keep as low-level staticcall fallback for A path. Worker B skips this.
    function verifyStorageProof(bytes calldata proof) external view returns (bool);
}

contract GOPassRegistry is Ownable {
    using RLPReader for *;
    struct Record {
        uint8 tier;
        uint8 subTier;
        bytes2 group;
        bytes2 subGroup;
        uint256 countryBitmap;
        uint64 expiry;
        bool frozen;
        bool active;
        bytes32 customerIdHash;
        string kycSource; // e.g. "sumsub" or "" — mirrors GOPass, not used in eligibility
    }

    struct Rule {
        bytes2 allowed_group;
        bytes2 allowed_sub_group;
        uint8 min_tier;
        uint8 min_sub_tier;
        bool is_black_list; // true = countriesBitmap is blocklist (reject if wallet has any bit in it), false = allowlist (require at least one bit)
        uint256 countriesBitmap; // ISO2 bitmap e.g. US|SG = bits 0,1; CN|HK = bits 5,3 via CountryBitmap
    }

    mapping(address => Record) public cached;
    mapping(address => uint64) public verifiedUntil;
    mapping(address => bool) public isVerified;

    address public immutable GOPASS_ADDR; // on Sepolia (the hub whose txs are proven)
    uint64 public immutable SOURCE_CHAIN_KEY; // chainKey of the source chain for 0x0FD2 (1 = Sepolia)
    uint64 public cacheTTL = 24 hours;
    address public constant BLOCK_PROVER = address(0x0FD2);
    address public worker; // trusted fallback path only (syncPass); see below

    /// @notice keccak256("PassMinted(address,uint256,bytes32,uint64)")
    bytes32 public constant PASS_MINTED_TOPIC0 = keccak256(bytes("PassMinted(address,uint256,bytes32,uint64)"));

    event PassSynced(address indexed wallet, bytes32 recordHash, uint64 verifiedUntil);
    event PassInvalidated(address indexed wallet);

    modifier onlyWorkerOrOwner() {
        require(msg.sender == worker || msg.sender == owner(), "only worker/owner");
        _;
    }

    constructor(address gopassAddr, uint64 sourceChainKey) {
        require(gopassAddr != address(0), "gopass zero");
        // The 0x0FD2 precompile must be live where this registry is deployed; never accept
        // proofs unchecked on a chain without it.
        require(block.chainid == 102031 || block.chainid == 102030 || block.chainid == 31337, "unsupported chain");
        GOPASS_ADDR = gopassAddr;
        SOURCE_CHAIN_KEY = sourceChainKey;
    }

    function setCacheTTL(uint64 ttl) external onlyOwner {
        cacheTTL = ttl;
    }

    function setWorker(address w) external onlyOwner {
        require(w != address(0), "worker zero");
        worker = w;
    }

    // EXPERIMENTAL fallback (worker/owner only): raw storage-proof staticcall. The Attestcoin docs
    // define no raw storage-proof precompile API — use syncPassWithTxProof (tx-inclusion path) instead.
    function syncPass(address wallet, Record calldata r, bytes calldata proof) external onlyWorkerOrOwner {
        require(wallet != address(0), "wallet zero");
        require(r.expiry > block.timestamp, "expiry past");
        bytes32 expected = keccak256(abi.encode(r));
        require(proof.length > 0, "proof empty");
        if (block.chainid != 31337) {
            (bool ok,) = BLOCK_PROVER.staticcall(proof);
            require(ok, "proof verify failed");
        }
        cached[wallet] = r;
        verifiedUntil[wallet] = uint64(block.timestamp) + cacheTTL;
        isVerified[wallet] = true;
        emit PassSynced(wallet, expected, verifiedUntil[wallet]);
    }

    // Real tx-inclusion path (available now on CC3 102031): prove the GOPass mint tx via ProofBuilder +
    // 0x0FD2 verifySingle, then decode the verified encodedTransaction on-chain (Attestcoin Phase 4):
    // receipt status must be success and the PassMinted log emitted by GOPASS_ADDR must carry the
    // record hash of the submitted record. Anyone can call — the record fields are cryptographically
    // bound to the proven tx, no privileged worker needed.
    function syncPassWithTxProof(
        address wallet,
        Record calldata r,
        uint64 headerNumber,
        bytes calldata txBytes,
        bytes32 merkleRoot,
        bytes32[] calldata siblings,
        bytes32 lowerDigest,
        bytes32[] calldata roots
    ) external {
        require(wallet != address(0), "wallet zero");
        require(r.expiry > block.timestamp, "expiry past");
        bytes32 expected = keccak256(abi.encode(r));
        if (block.chainid != 31337) {
            // call PrecompileBlockProver.verifySingle(chainKey, headerNumber, txBytes, merkleRoot, siblings, lowerDigest, roots)
            bytes memory callData = abi.encodeWithSignature(
                "verifySingle(uint64,uint64,bytes,bytes32,bytes32[],bytes32,bytes32[])",
                SOURCE_CHAIN_KEY,
                headerNumber,
                txBytes,
                merkleRoot,
                siblings,
                lowerDigest,
                roots
            );
            (bool ok, bytes memory ret) = BLOCK_PROVER.staticcall(callData);
            require(ok && abi.decode(ret, (bool)), "tx proof verify failed");
        }
        // Phase 4: decode verified tx bytes — binds the record to the real mint tx (status + event).
        _decodePassMinted(txBytes, wallet, expected, r.expiry);
        cached[wallet] = r;
        verifiedUntil[wallet] = uint64(block.timestamp) + cacheTTL;
        isVerified[wallet] = true;
        emit PassSynced(wallet, expected, verifiedUntil[wallet]);
    }

    /// @notice Attestcoin Phase 4 (Data Extraction): decode the verified encodedTransaction
    ///         (tx RLP [+ envelope byte] || receipt RLP) and require a PassMinted log emitted by
    ///         GOPASS_ADDR whose wallet / recordHash / expiry match the submitted record.
    function _decodePassMinted(bytes memory data, address wallet, bytes32 expectedHash, uint64 expiry) internal view {
        uint256 start;
        uint256 firstByte;
        assembly ("memory-safe") {
            firstByte := byte(0, mload(add(data, 32)))
        }
        if (firstByte == 0x01 || firstByte == 0x02) start = 1; // EIP-2718 typed tx envelope

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
            address emitter = logItem.itemAt(data, 0).toAddress(data);
            if (emitter != GOPASS_ADDR) continue;

            RLPReader.RLPItem memory topics = logItem.itemAt(data, 1);
            if (!topics.isList || _countItems(topics, data) < 3) continue;
            if (topics.itemAt(data, 0).toBytes32(data) != PASS_MINTED_TOPIC0) continue;

            address logWallet = address(uint160(uint256(topics.itemAt(data, 1).toBytes32(data))));
            if (logWallet != wallet) revert("wallet mismatch");

            bytes memory logData = logItem.itemAt(data, 2).toBytes(data);
            require(logData.length == 64, "bad log data");

            bytes32 logHash;
            uint64 logExpiry;
            assembly ("memory-safe") {
                logHash := mload(add(logData, 32))
                // uint64 sits in the LOW 8 bytes of the ABI word
                logExpiry := and(mload(add(logData, 64)), 0xFFFFFFFFFFFFFFFF)
            }
            require(logHash == expectedHash, "recordHash mismatch");
            require(logExpiry == expiry, "expiry mismatch");
            return;
        }
        revert("PassMinted not found");
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

    function invalidate(address wallet) external onlyOwner {
        delete cached[wallet];
        delete verifiedUntil[wallet];
        isVerified[wallet] = false;
        emit PassInvalidated(wallet);
    }

    function isEligible(address wallet, Rule calldata rule) public view returns (bool) {
        if (!isVerified[wallet]) return false;
        Record storage rec = cached[wallet];
        if (rec.frozen) return false;
        if (block.timestamp >= rec.expiry) return false;
        if (block.timestamp >= verifiedUntil[wallet]) return false;
        if (rec.tier < rule.min_tier) return false;
        if (rec.subTier < rule.min_sub_tier) return false;
        if (rule.allowed_group != bytes2(0) && rec.group != rule.allowed_group) return false;
        if (rule.allowed_sub_group != bytes2(0) && rec.subGroup != rule.allowed_sub_group) return false;
        if (rule.countriesBitmap != 0) {
            if (rule.is_black_list) {
                if ((rec.countryBitmap & rule.countriesBitmap) != 0) return false;
            } else {
                if ((rec.countryBitmap & rule.countriesBitmap) == 0) return false;
            }
        }
        return true;
    }

    function getRecord(address wallet) external view returns (Record memory) {
        return cached[wallet];
    }
}
