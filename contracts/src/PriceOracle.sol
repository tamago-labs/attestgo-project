// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import {IOracle} from "./interfaces/IOracle.sol";
import {AggregatorV2V3Interface} from "./interfaces/AggregatorV2V3Interface.sol";

/// @title PriceOracle
/// @notice A multi-source price oracle
///         Each instance is bound to one collateral/loan pair at construction.
///         Supports 2 oracle sources: Fallback (admin-set) and BKC (Chainlink-style).
///         Prices are fetched in USD (scaled by 1e18) and converted to Morpho's expected format.
contract PriceOracle is IOracle {
    // ──────────────────────────── Immutables ────────────────────────────
    address public immutable LOAN_TOKEN;
    address public immutable COLLATERAL_TOKEN;
    uint8 public immutable LOAN_TOKEN_DECIMALS;
    uint8 public immutable COLLATERAL_TOKEN_DECIMALS;

    // ──────────────────────────── Storage ───────────────────────────────
    address public owner;

    // Fallback USD prices (scaled by 1e18)
    uint256 public collateralUsdPrice;
    uint256 public loanUsdPrice;
    uint256 public lastPriceUpdateTime;

    // Oracle mode per side: 0=fallback, 1=Chainlink-style
    uint8 public collateralOracleMode;
    uint8 public loanOracleMode;

    // BKC / Chainlink-style aggregators
    address public collateralBkcAggregator;
    address public loanBkcAggregator;

    // Configuration
    uint256 public stalenessThreshold;
    uint256 public constant MAX_PRICE_DEVIATION_BPS = 5000; // 50%
    uint256 public constant PRICE_UPDATE_DELAY = 1 hours;

    // Invert mode per side (default: false)
    // When true, the raw price is inverted: 1e36 / rawPrice
    bool public collateralInvertMode;
    bool public loanInvertMode;

    // Access control
    mapping(address => bool) public whitelist;

    // ──────────────────────────── Events ────────────────────────────────
    event PriceUpdated(uint256 collateralUsdPrice, uint256 loanUsdPrice);
    event WhitelistUpdated(address indexed user, bool whitelisted);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event OracleModeSet(uint8 collateralMode, uint8 loanMode);
    event BkcFeedSet(address collateralAggregator, address loanAggregator);
    event StalenessThresholdUpdated(uint256 newThreshold);
    event InvertModeSet(bool collateralInvert, bool loanInvert);

    // ──────────────────────────── Errors ────────────────────────────────
    error NotWhitelisted();
    error NotOwner();
    error ZeroPrice();
    error UpdateTooFrequent();
    error PriceDeviationTooHigh();
    error InvalidOracleMode();
    error FeedNotConfigured();

    // ──────────────────────────── Constructor ───────────────────────────
    constructor(
        address loanToken,
        address collateralToken,
        uint256 initialCollateralUsdPrice,
        uint256 initialLoanUsdPrice,
        uint8 loanTokenDecimals,
        uint8 collateralTokenDecimals
    ) {
        owner = msg.sender;
        whitelist[msg.sender] = true;
        LOAN_TOKEN = loanToken;
        COLLATERAL_TOKEN = collateralToken;
        LOAN_TOKEN_DECIMALS = loanTokenDecimals;
        COLLATERAL_TOKEN_DECIMALS = collateralTokenDecimals;
        collateralUsdPrice = initialCollateralUsdPrice;
        loanUsdPrice = initialLoanUsdPrice;
        lastPriceUpdateTime = block.timestamp;
        stalenessThreshold = 3600; // 1 hour default
    }

    // ──────────────────────────── IOracle.price() ───────────────────────

    /// @notice Returns the price of 1 raw collateral unit in raw loan units, scaled by 1e36 (ORACLE_PRICE_SCALE).
    ///         Formula: (collateralUSD / loanUSD) * 10^(loanDecimals + 36 - collateralDecimals)
    function price() external view returns (uint256) {
        uint256 collUsd = _getCollateralUsdPrice();
        uint256 loanUsd = _getLoanUsdPrice();
        require(collUsd > 0, "collateral price not set");
        require(loanUsd > 0, "loan price not set");

        uint256 priceScale = 10 ** (uint256(LOAN_TOKEN_DECIMALS) + 36 - uint256(COLLATERAL_TOKEN_DECIMALS));
        return (collUsd * priceScale) / loanUsd;
    }

    // ──────────────────────────── Internal Price Fetchers ───────────────

    function _getCollateralUsdPrice() internal view returns (uint256) {
        uint256 rawPrice;
        uint8 mode = collateralOracleMode;
        if (mode == 0) rawPrice = collateralUsdPrice;
        else if (mode == 1) rawPrice = _getBkcPrice(collateralBkcAggregator);
        else revert InvalidOracleMode();

        if (collateralInvertMode) {
            require(rawPrice > 0, "cannot invert zero collateral price");
            return 1e36 / rawPrice;
        }
        return rawPrice;
    }

    function _getLoanUsdPrice() internal view returns (uint256) {
        uint256 rawPrice;
        uint8 mode = loanOracleMode;
        if (mode == 0) rawPrice = loanUsdPrice;
        else if (mode == 1) rawPrice = _getBkcPrice(loanBkcAggregator);
        else revert InvalidOracleMode();

        if (loanInvertMode) {
            require(rawPrice > 0, "cannot invert zero loan price");
            return 1e36 / rawPrice;
        }
        return rawPrice;
    }

    // ──────────────────────────── BKC (Chainlink-style) ─────────────────

    function _getBkcPrice(address aggregator) internal view returns (uint256) {
        if (aggregator == address(0)) revert FeedNotConfigured();

        (, int256 answer, , uint256 updatedAt, ) = AggregatorV2V3Interface(aggregator).latestRoundData();

        require(answer > 0, "Invalid BKC price");
        require(block.timestamp - updatedAt <= stalenessThreshold, "BKC price too stale");

        // Get aggregator decimals and normalize to 18 decimals
        uint8 aggDecimals = AggregatorV2V3Interface(aggregator).decimals();
        uint256 aggPrice = uint256(answer);

        if (aggDecimals < 18) {
            aggPrice = aggPrice * (10 ** (18 - aggDecimals));
        } else if (aggDecimals > 18) {
            aggPrice = aggPrice / (10 ** (aggDecimals - 18));
        }

        return aggPrice;
    }

    // ──────────────────────────── Fallback Price Setter ─────────────────

    /// @notice Update USD prices for both assets (fallback mode). Only callable by whitelisted addresses.
    function setPrice(uint256 newCollateralUsdPrice, uint256 newLoanUsdPrice) external {
        if (!whitelist[msg.sender]) revert NotWhitelisted();
        if (newCollateralUsdPrice == 0 || newLoanUsdPrice == 0) revert ZeroPrice();
        if (block.timestamp < lastPriceUpdateTime + PRICE_UPDATE_DELAY) revert UpdateTooFrequent();

        collateralUsdPrice = newCollateralUsdPrice;
        loanUsdPrice = newLoanUsdPrice;
        lastPriceUpdateTime = block.timestamp;

        emit PriceUpdated(newCollateralUsdPrice, newLoanUsdPrice);
    }

    // ──────────────────────────── Admin: Oracle Configuration ───────────

    /// @notice Set BKC/Chainlink-style aggregators for both tokens, and enable BKC mode.
    function setBkcFeed(address collateralAggregator, address loanAggregator) external {
        if (msg.sender != owner) revert NotOwner();
        require(collateralAggregator != address(0) && loanAggregator != address(0), "Zero aggregator");
        collateralBkcAggregator = collateralAggregator;
        loanBkcAggregator = loanAggregator;
        collateralOracleMode = 1;
        loanOracleMode = 1;
        emit BkcFeedSet(collateralAggregator, loanAggregator);
        emit OracleModeSet(1, 1);
    }

    /// @notice Manually set oracle modes for each side independently.
    ///         0 = fallback, 1 = Chainlink-style
    function setOracleMode(uint8 collateralMode, uint8 loanMode) external {
        if (msg.sender != owner) revert NotOwner();
        if (collateralMode > 1 || loanMode > 1) revert InvalidOracleMode();
        collateralOracleMode = collateralMode;
        loanOracleMode = loanMode;
        emit OracleModeSet(collateralMode, loanMode);
    }

    /// @notice Set the staleness threshold (in seconds) for BKC price freshness.
    function setStalenessThreshold(uint256 newThreshold) external {
        if (msg.sender != owner) revert NotOwner();
        require(newThreshold > 0, "Zero threshold");
        stalenessThreshold = newThreshold;
        emit StalenessThresholdUpdated(newThreshold);
    }

    /// @notice Enable or disable price inversion for collateral and/or loan side.
    ///         When enabled, the raw price from any oracle source is inverted: 1e36 / rawPrice.
    ///         Useful when a feed quotes in the wrong direction (e.g. JPY/USD instead of USD/JPY).
    function setInvertMode(bool collateralInvert, bool loanInvert) external {
        if (msg.sender != owner) revert NotOwner();
        collateralInvertMode = collateralInvert;
        loanInvertMode = loanInvert;
        emit InvertModeSet(collateralInvert, loanInvert);
    }

    // ──────────────────────────── Access Control ────────────────────────

    function addToWhitelist(address user) external {
        if (msg.sender != owner) revert NotOwner();
        whitelist[user] = true;
        emit WhitelistUpdated(user, true);
    }

    function removeFromWhitelist(address user) external {
        if (msg.sender != owner) revert NotOwner();
        whitelist[user] = false;
        emit WhitelistUpdated(user, false);
    }

    function transferOwnership(address newOwner) external {
        if (msg.sender != owner) revert NotOwner();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    // ──────────────────────────── View Helpers ──────────────────────────

    /// @notice Get the current collateral USD price from the active oracle source.
    function getCollateralUsdPrice() external view returns (uint256) {
        return _getCollateralUsdPrice();
    }

    /// @notice Get the current loan USD price from the active oracle source.
    function getLoanUsdPrice() external view returns (uint256) {
        return _getLoanUsdPrice();
    }

    /// @notice Get detailed price info for debugging.
    function getPriceInfo() external view returns (
        uint8 collMode,
        uint8 lnMode,
        uint256 collUsd,
        uint256 lnUsd,
        uint256 morphoPrice
    ) {
        collMode = collateralOracleMode;
        lnMode = loanOracleMode;
        collUsd = _getCollateralUsdPrice();
        lnUsd = _getLoanUsdPrice();
        uint256 priceScale = 10 ** (uint256(LOAN_TOKEN_DECIMALS) + 36 - uint256(COLLATERAL_TOKEN_DECIMALS));
        morphoPrice = (collUsd * priceScale) / lnUsd;
    }
}
