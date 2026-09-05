// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * GOPassRegistry — Attestcoin Smart Contract on Creditcoin (102031) for the Sepolia GOPass hub
 * (11155111, chainKey 1).
 * Sepolia GOPass mints pending (active=false); this registry verifies the mint tx inclusion via
 * 0x0FD2 `verifySingle` (trustless), then decodes the verified encodedTransaction on-chain
 * (Attestcoin Phase 4: `PassMinted` log emitted by GOPASS_ADDR with
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
    ///         (ABI-encoded (transaction, receipt) blob from the ProofBuilder) and require a
    ///         PassMinted log emitted by GOPASS_ADDR whose wallet / recordHash / expiry match the
    ///         submitted record. Receipt status is implied: the log only exists on success.
    /// @dev Word-aligned scan for the log pattern
    ///      [emitter, offTopics, offData, topicCount, topic0, topic1, topic2, dataLen, data...];
    ///      the tx head must target GOPASS_ADDR (head words precede the attacker-controlled
    ///      calldata section, defeating forged log patterns inside calldata).
    function _decodePassMinted(bytes memory data, address wallet, bytes32 expectedHash, uint64 expiry) internal view {
        uint256 words = data.length / 32;
        require(words > 15, "txBytes too short");

        bool toHub;
        for (uint256 j = 6; j <= 14 && !toHub; j++) {
            if (address(uint160(uint256(_wordAt(data, j)))) == GOPASS_ADDR) toHub = true;
        }
        require(toHub, "tx not to GOPass");

        for (uint256 i = 4; i + 5 < words; i++) {
            if (_wordAt(data, i) != PASS_MINTED_TOPIC0) continue;
            if (address(uint160(uint256(_wordAt(data, i - 4)))) != GOPASS_ADDR) continue;
            if (uint256(_wordAt(data, i - 1)) != 3) continue; // topic count = 3
            if (uint256(_wordAt(data, i + 3)) != 64) continue; // log data length = 64

            address logWallet = address(uint160(uint256(_wordAt(data, i + 1))));
            if (logWallet != wallet) revert("wallet mismatch");

            bytes32 logHash = _wordAt(data, i + 4);
            // uint64 sits in the LOW 8 bytes of the ABI word
            uint64 logExpiry = uint64(uint256(_wordAt(data, i + 5)));
            require(logHash == expectedHash, "recordHash mismatch");
            require(logExpiry == expiry, "expiry mismatch");
            return;
        }
        revert("PassMinted not found");
    }

    /// @notice Reads the `idx`-th 32-byte word of `data` (encodedTransaction is ABI word-aligned).
    function _wordAt(bytes memory data, uint256 idx) internal pure returns (bytes32 w) {
        assembly ("memory-safe") {
            w := mload(add(data, add(32, mul(32, idx))))
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
