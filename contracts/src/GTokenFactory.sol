// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {GToken} from "./GToken.sol";

/**
 * GTokenFactory — seamlessly issue GToken (native or wrapped) via `new` (option A).
 * Both modes use single GToken contract: underlying==0 native, else wrapped ERC20.
 * Indexes all tokens for discovery; token owner = creator (msg.sender).
 */
contract GTokenFactory is Ownable {
    address public eligibleProvider;

    address[] public allTokens;
    mapping(address => bool) public isGToken;
    mapping(address => address) public underlyingOf;
    mapping(address => address) public creatorOf;
    mapping(address => address[]) public tokensByCreator;

    event GTokenCreated(address indexed token, address indexed creator, string name, string symbol, GToken.Rule rule, address underlying);
    event ProviderUpdated(address indexed provider);

    constructor(address provider_) {
        require(provider_ != address(0), "provider zero");
        eligibleProvider = provider_;
    }

    function setProvider(address provider_) external onlyOwner {
        require(provider_ != address(0), "provider zero");
        eligibleProvider = provider_;
        emit ProviderUpdated(provider_);
    }

    function createGToken(string calldata name_, string calldata symbol_, GToken.Rule calldata rule_, string calldata iconURI_) external returns (address token) {
        GToken g = new GToken(name_, symbol_, eligibleProvider, rule_, iconURI_, address(0));
        token = address(g);
        g.transferOwnership(msg.sender);
        allTokens.push(token);
        isGToken[token] = true;
        underlyingOf[token] = address(0);
        creatorOf[token] = msg.sender;
        tokensByCreator[msg.sender].push(token);
        emit GTokenCreated(token, msg.sender, name_, symbol_, rule_, address(0));
    }

    function createWrappedGToken(address underlying_, string calldata name_, string calldata symbol_, GToken.Rule calldata rule_, string calldata iconURI_) external returns (address token) {
        require(underlying_ != address(0), "underlying zero");
        require(underlying_.code.length > 0, "underlying not contract");
        GToken g = new GToken(name_, symbol_, eligibleProvider, rule_, iconURI_, underlying_);
        token = address(g);
        g.transferOwnership(msg.sender);
        allTokens.push(token);
        isGToken[token] = true;
        underlyingOf[token] = underlying_;
        creatorOf[token] = msg.sender;
        tokensByCreator[msg.sender].push(token);
        emit GTokenCreated(token, msg.sender, name_, symbol_, rule_, underlying_);
    }

    function allTokensLength() external view returns (uint256) {
        return allTokens.length;
    }

    function getTokensByCreator(address creator) external view returns (address[] memory) {
        return tokensByCreator[creator];
    }

    function isWrapped(address token) external view returns (bool) {
        return underlyingOf[token] != address(0);
    }
}
