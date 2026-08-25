// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * GOPassMirror — dest chain mirror for universal pass (e.g. Base chainKey 2)
 * Hub GOPass on Sepolia (chainKey 1) → CC GOPassRegistry verifies via 0x0FD2 → worker syncs to this mirror.
 * GToken on new chain checks this mirror isEligible locally (5k gas), no new mint, one customerIdHash works everywhere.
 * CC is single source of truth checks duplicate; mirror is just cache.
 */
contract GOPassMirror is Ownable {
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
        string kycSource;
    }

    struct Rule {
        bytes2 allowed_group;
        bytes2 allowed_sub_group;
        uint8 min_tier;
        uint8 min_sub_tier;
        bool is_black_list;
        uint256 countriesBitmap;
    }

    mapping(address => Record) public cached;
    mapping(address => uint64) public verifiedUntil;
    mapping(address => bool) public isVerified;

    uint64 public cacheTTL = 24 hours;
    address public worker;

    event PassSynced(address indexed wallet, bytes32 recordHash, uint64 verifiedUntil);
    event PassInvalidated(address indexed wallet);
    event WorkerUpdated(address indexed worker);

    modifier onlyWorkerOrOwner() {
        require(msg.sender == worker || msg.sender == owner(), "only worker/owner");
        _;
    }

    constructor() {}

    function setWorker(address w) external onlyOwner {
        worker = w;
        emit WorkerUpdated(w);
    }

    function setCacheTTL(uint64 ttl) external onlyOwner {
        cacheTTL = ttl;
    }

    // trusted worker sync from CC registry after CC verified (like loan-flow CC→Sepolia registerLoanFund)
    function syncFromCC(address wallet, Record calldata r) external onlyWorkerOrOwner {
        require(wallet != address(0), "wallet zero");
        require(r.expiry > block.timestamp, "expiry past");
        cached[wallet] = r;
        verifiedUntil[wallet] = uint64(block.timestamp) + cacheTTL;
        isVerified[wallet] = true;
        emit PassSynced(wallet, keccak256(abi.encode(r)), verifiedUntil[wallet]);
    }

    function invalidate(address wallet) external onlyWorkerOrOwner {
        delete cached[wallet];
        delete verifiedUntil[wallet];
        isVerified[wallet] = false;
        emit PassInvalidated(wallet);
    }

    function isEligible(address wallet, Rule calldata rule) public view returns (bool) {
        if (!isVerified[wallet]) return false;
        Record storage rec = cached[wallet];
        if (!rec.active) return false;
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
