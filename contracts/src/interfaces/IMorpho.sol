// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;

// Type definitions at file level
type Id is bytes32;

struct MarketParams {
    address loanToken;
    address collateralToken;
    address oracle;
    address irm;
    uint256 lltv;
}

struct Market {
    uint128 totalSupplyAssets;
    uint128 totalSupplyShares;
    uint128 totalBorrowAssets;
    uint128 totalBorrowShares;
    uint48 lastUpdate;
    uint48 fee;
}

struct Position {
    uint256 supplyShares;
    uint128 borrowShares;
    uint128 collateral;
}

struct Authorization {
    address authorizer;
    address authorized;
    bool isAuthorized;
    uint256 nonce;
    uint256 deadline;
}

struct Signature {
    uint8 v;
    bytes32 r;
    bytes32 s;
}

// Minimal interfaces for compilation
interface IMorphoStaticTyping {
    function extSloads(bytes32[] calldata slots) external view returns (bytes32[] memory);
}
interface IMorphoBase {
    function owner() external view returns (address);
    function isLltvEnabled(uint256 lltv) external view returns (bool);
    function isIrmEnabled(address irm) external view returns (bool);
    function flashLoan(address token, uint256 assets, bytes calldata data) external;
    function market(Id id) external view returns (Market memory);
    function position(Id id, address user) external view returns (Position memory);
    function enableIrm(address irm) external;
    function enableLltv(uint256 lltv) external;
    function createMarket(MarketParams memory marketParams) external;
    function idToMarketParams(Id id) external view returns (MarketParams memory);
    function supply(MarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, bytes calldata data) external returns (uint256, uint256);
    function supplyCollateral(MarketParams memory marketParams, uint256 assets, address onBehalf, bytes calldata data) external;
    function borrow(MarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) external returns (uint256, uint256);
    function withdraw(MarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) external returns (uint256, uint256);
    function withdrawCollateral(MarketParams memory marketParams, uint256 assets, address onBehalf, address receiver) external;
    function repay(MarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, bytes calldata data) external returns (uint256, uint256);
    function liquidate(MarketParams memory marketParams, address borrower, uint256 seizedAssets, uint256 repaidShares, bytes calldata data) external returns (uint256, uint256);
    function supplyRemoteCollateral(MarketParams memory marketParams, bytes32 lockId, uint256 assets, address onBehalf) external;
    function withdrawRemoteCollateral(MarketParams memory marketParams, uint256 assets, address onBehalf) external;
    function setRemoteCollateralManager(address newRemoteCollateralManager) external;
    function setFeeRecipient(address newFeeRecipient) external;
    function setOwner(address newOwner) external;
    function accrueInterest(MarketParams memory marketParams) external;
}
interface IMorpho is IMorphoStaticTyping, IMorphoBase {}
