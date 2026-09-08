// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * GOPass — hub soulbound NFT on Sepolia (11155111, chainKey 1), pending until Creditcoin approves
 * Mint by operator creates Record with active=false; not eligible until Creditcoin GOPassRegistry
 * verifies tx via 0x0FD2 and worker calls setActive(true). Single source of truth is Creditcoin.
 * Soulbound: no transfers (mint/burn only), tokenId = uint160(wallet).
 * Record hash commitment: mapping(address=>bytes32) = 1 slot/wallet for cheap storage proof.
 */
contract GOPass is ERC721, Ownable {
    struct Record {
        uint8 tier; // 0-99 (tier >= min_tier to pass)
        uint8 subTier; // 0-99
        bytes2 group; // 2 chars or 0x0000 empty
        bytes2 subGroup; // 2 chars or 0x0000 empty
        uint256 countryBitmap; // ISO2 bitmap, see CountryBitmap lib
        uint64 expiry; // unix seconds
        bool frozen;
        bool active; // false = pending CC approval, true = verified on CC
        bytes32 customerIdHash; // keccak(customerId) — uniqueness, no PII on-chain
        string kycSource; // e.g. "sumsub" or "" (blank) — not required, default ""
    }

    mapping(address => Record) private _records;
    mapping(address => bytes32) public recordHash; // 1 slot/wallet — proven to CC via 0x0FD2
    mapping(bytes32 => address) public hashToWallet; // uniqueness of customerIdHash

    string private _baseTokenURI;
    address public worker; // authorized to setActive after CC approval

    event PassMinted(address indexed wallet, uint256 indexed tokenId, bytes32 recordHash, uint64 expiry);
    event PassUpdated(address indexed wallet, bytes32 recordHash);
    event PassFrozen(address indexed wallet, bool frozen);
    event PassActive(address indexed wallet, bool active);
    event PassBurned(address indexed wallet, uint256 indexed tokenId);

    constructor(string memory baseURI_) ERC721("GO Pass", "GOPASS") {
        _baseTokenURI = baseURI_;
    }

    function setBaseURI(string calldata uri) external onlyOwner {
        _baseTokenURI = uri;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function getRecord(address wallet) external view returns (Record memory) {
        return _records[wallet];
    }

    function hasPass(address wallet) external view returns (bool) {
        return recordHash[wallet] != bytes32(0);
    }

    function setWorker(address w) external onlyOwner {
        worker = w;
    }

    modifier onlyWorkerOrOwner() {
        require(msg.sender == worker || msg.sender == owner(), "only worker/owner");
        _;
    }

    function isEligible(address wallet, Rule memory rule) public view returns (bool) {
        if (recordHash[wallet] == bytes32(0)) return false;
        Record storage rec = _records[wallet];
        if (!rec.active) return false;
        if (rec.frozen) return false;
        if (block.timestamp >= rec.expiry) return false;
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

    struct Rule {
        bytes2 allowed_group;
        bytes2 allowed_sub_group;
        uint8 min_tier;
        uint8 min_sub_tier;
        bool is_black_list;
        uint256 countriesBitmap;
    }

    function mint(address to, Record calldata r) external onlyOwner {
        require(to != address(0), "to zero");
        require(r.expiry > block.timestamp, "expiry past");
        require(recordHash[to] == bytes32(0), "already minted");
        require(hashToWallet[r.customerIdHash] == address(0) || r.customerIdHash == bytes32(0), "customerId used");
        Record memory stored = r;
        stored.active = false; // always pending until CC approves
        _records[to] = stored;
        bytes32 h = keccak256(abi.encode(stored));
        recordHash[to] = h;
        if (stored.customerIdHash != bytes32(0)) hashToWallet[stored.customerIdHash] = to;
        uint256 tokenId = uint160(to);
        _mint(to, tokenId);
        emit PassMinted(to, tokenId, h, r.expiry);
    }

    function update(address wallet, Record calldata r) external onlyOwner {
        require(recordHash[wallet] != bytes32(0), "not minted");
        require(r.expiry > block.timestamp, "expiry past");
        Record storage cur = _records[wallet];
        if (cur.customerIdHash != r.customerIdHash) {
            if (cur.customerIdHash != bytes32(0)) delete hashToWallet[cur.customerIdHash];
            require(r.customerIdHash == bytes32(0) || hashToWallet[r.customerIdHash] == address(0), "customerId used");
            if (r.customerIdHash != bytes32(0)) hashToWallet[r.customerIdHash] = wallet;
        }
        bool keepActive = cur.active;
        _records[wallet] = r;
        _records[wallet].active = keepActive;
        bytes32 h = keccak256(abi.encode(_records[wallet]));
        recordHash[wallet] = h;
        emit PassUpdated(wallet, h);
    }

    function setActive(address wallet, bool active) external onlyWorkerOrOwner {
        require(recordHash[wallet] != bytes32(0), "not minted");
        _records[wallet].active = active;
        bytes32 h = keccak256(abi.encode(_records[wallet]));
        recordHash[wallet] = h;
        emit PassActive(wallet, active);
    }

    function setFrozen(address wallet, bool frozen) external onlyOwner {
        require(recordHash[wallet] != bytes32(0), "not minted");
        _records[wallet].frozen = frozen;
        bytes32 h = keccak256(abi.encode(_records[wallet]));
        recordHash[wallet] = h;
        emit PassFrozen(wallet, frozen);
    }

    function setExpiry(address wallet, uint64 expiry) external onlyOwner {
        require(recordHash[wallet] != bytes32(0), "not minted");
        require(expiry > block.timestamp, "expiry past");
        _records[wallet].expiry = expiry;
        bytes32 h = keccak256(abi.encode(_records[wallet]));
        recordHash[wallet] = h;
        emit PassUpdated(wallet, h);
    }

    function burn(address wallet) external onlyOwner {
        require(recordHash[wallet] != bytes32(0), "not minted");
        Record memory cur = _records[wallet];
        if (cur.customerIdHash != bytes32(0)) delete hashToWallet[cur.customerIdHash];
        delete _records[wallet];
        delete recordHash[wallet];
        uint256 tokenId = uint160(wallet);
        _burn(tokenId);
        emit PassBurned(wallet, tokenId);
    }

    // Soulbound: block transfers (allow mint/burn only)
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal override {
        require(from == address(0) || to == address(0), "soulbound: non-transferable");
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
}
