// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {GToken} from "./GToken.sol";

/**
 * GTokenFactory — issue GToken (native or wrapped) on behalf of issuer.
 * Platform API (owner/operator) pays gas, tokenOwner (issuer) becomes GToken owner.
 * Both modes via single GToken: underlying==0 native else wrapped.
 */
contract GTokenFactory is Ownable {
    address public eligibleProvider;

    address[] public allTokens;
    mapping(address => bool) public isGToken;
    mapping(address => address) public underlyingOf;
    mapping(address => address) public creatorOf;
    mapping(address => address[]) public tokensByCreator;
    mapping(address => bool) public isOperator;

    event GTokenCreated(address indexed token, address indexed creator, address indexed caller, string name, string symbol, GToken.Rule rule, address underlying);
    event ProviderUpdated(address indexed provider);
    event OperatorUpdated(address indexed operator, bool allowed);

    modifier onlyOperatorOrOwner() {
        require(msg.sender == owner() || isOperator[msg.sender], "not operator/owner");
        _;
    }

    constructor(address provider_) {
        require(provider_ != address(0), "provider zero");
        eligibleProvider = provider_;
    }

    function setProvider(address provider_) external onlyOwner {
        require(provider_ != address(0), "provider zero");
        eligibleProvider = provider_;
        emit ProviderUpdated(provider_);
    }

    function setOperator(address op, bool allowed) external onlyOwner {
        isOperator[op] = allowed;
        emit OperatorUpdated(op, allowed);
    }

    function createGTokenFor(address tokenOwner, string calldata name_, string calldata symbol_, GToken.Rule calldata rule_, string calldata iconURI_) public onlyOperatorOrOwner returns (address token) {
        require(tokenOwner != address(0), "owner zero");
        GToken g = new GToken(name_, symbol_, eligibleProvider, rule_, iconURI_, address(0));
        token = address(g);
        g.transferOwnership(tokenOwner);
        allTokens.push(token);
        isGToken[token] = true;
        underlyingOf[token] = address(0);
        creatorOf[token] = tokenOwner;
        tokensByCreator[tokenOwner].push(token);
        emit GTokenCreated(token, tokenOwner, msg.sender, name_, symbol_, rule_, address(0));
    }

    function createWrappedGTokenFor(address tokenOwner, address underlying_, string calldata name_, string calldata symbol_, GToken.Rule calldata rule_, string calldata iconURI_) public onlyOperatorOrOwner returns (address token) {
        require(tokenOwner != address(0), "owner zero");
        require(underlying_ != address(0), "underlying zero");
        require(underlying_.code.length > 0, "underlying not contract");
        GToken g = new GToken(name_, symbol_, eligibleProvider, rule_, iconURI_, underlying_);
        token = address(g);
        g.transferOwnership(tokenOwner);
        allTokens.push(token);
        isGToken[token] = true;
        underlyingOf[token] = underlying_;
        creatorOf[token] = tokenOwner;
        tokensByCreator[tokenOwner].push(token);
        emit GTokenCreated(token, tokenOwner, msg.sender, name_, symbol_, rule_, underlying_);
    }

    // convenience wrappers — caller is owner, no operator check (anyone can self-issue)
    function createGToken(string calldata name_, string calldata symbol_, GToken.Rule calldata rule_, string calldata iconURI_) external returns (address token) {
        address tokenOwner = msg.sender;
        GToken g = new GToken(name_, symbol_, eligibleProvider, rule_, iconURI_, address(0));
        token = address(g);
        g.transferOwnership(tokenOwner);
        allTokens.push(token);
        isGToken[token] = true;
        underlyingOf[token] = address(0);
        creatorOf[token] = tokenOwner;
        tokensByCreator[tokenOwner].push(token);
        emit GTokenCreated(token, tokenOwner, msg.sender, name_, symbol_, rule_, address(0));
    }

    function createWrappedGToken(address underlying_, string calldata name_, string calldata symbol_, GToken.Rule calldata rule_, string calldata iconURI_) external returns (address token) {
        require(underlying_ != address(0), "underlying zero");
        require(underlying_.code.length > 0, "underlying not contract");
        address tokenOwner = msg.sender;
        GToken g = new GToken(name_, symbol_, eligibleProvider, rule_, iconURI_, underlying_);
        token = address(g);
        g.transferOwnership(tokenOwner);
        allTokens.push(token);
        isGToken[token] = true;
        underlyingOf[token] = underlying_;
        creatorOf[token] = tokenOwner;
        tokensByCreator[tokenOwner].push(token);
        emit GTokenCreated(token, tokenOwner, msg.sender, name_, symbol_, rule_, underlying_);
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
