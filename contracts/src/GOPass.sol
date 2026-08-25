// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * GOPass — hub registry + soulbound NFT on Creditcoin (102031 testnet)
 * Single source of truth: mint by Tamago/AttestGO operator (owner), verifiable anywhere via Attestcoin proof.
 * Mirrors Advance pattern: hub register, dest mirror via worker markVerified.
 * Soulbound: no transfers (mint/burn only), tokenId = uint160(wallet).
 * Record hash commitment: mapping(address=>bytes32) = 1 slot/wallet for cheap storage proof.
 */
contract GOPass is ERC721, Ownable {
    struct Record {
        uint8 tier; // 0-99 (Cleanverse min_tier semantics: tier > min_tier)
        uint8 subTier; // 0-99
        bytes2 group; // 2 chars or 0x0000 empty
        bytes2 subGroup; // 2 chars or 0x0000 empty
        uint256 countryBitmap; // ISO2 bitmap, see CountryBitmap lib
        uint64 expiry; // unix seconds
        bool frozen;
        bytes32 customerIdHash; // keccak(customerId) — uniqueness, no PII on-chain
    }

    mapping(address => Record) private _records;
    mapping(address => bytes32) public recordHash; // 1 slot/wallet — proven via 0x0FD2
    mapping(bytes32 => address) public hashToWallet; // uniqueness of customerIdHash

    string private _baseTokenURI;

    event PassMinted(address indexed wallet, uint256 indexed tokenId, bytes32 recordHash, uint64 expiry);
    event PassUpdated(address indexed wallet, bytes32 recordHash);
    event PassFrozen(address indexed wallet, bool frozen);
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

    function mint(address to, Record calldata r) external onlyOwner {
        require(to != address(0), "to zero");
        require(r.expiry > block.timestamp, "expiry past");
        require(recordHash[to] == bytes32(0), "already minted");
        require(hashToWallet[r.customerIdHash] == address(0) || r.customerIdHash == bytes32(0), "customerId used");
        _records[to] = r;
        bytes32 h = keccak256(abi.encode(r));
        recordHash[to] = h;
        if (r.customerIdHash != bytes32(0)) hashToWallet[r.customerIdHash] = to;
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
        _records[wallet] = r;
        bytes32 h = keccak256(abi.encode(r));
        recordHash[wallet] = h;
        emit PassUpdated(wallet, h);
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
