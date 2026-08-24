// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IPaymentStream {
    // ──────────────────────────── Enums ─────────────────────────────────
    enum StreamState { Created, Active, Paused, Ended }

    // ──────────────────────────── Events ────────────────────────────────
    event StreamStarted(uint256 indexed streamId, address indexed sender, address indexed recipient);
    event StreamPaused(uint256 indexed streamId, uint256 timestamp);
    event StreamResumed(uint256 indexed streamId, uint256 timestamp);
    event StreamEnded(uint256 indexed streamId, uint256 timestamp);
    event FundsClaimed(uint256 indexed streamId, address indexed recipient, uint256 amount);
    event Borrowed(uint256 indexed streamId, address indexed recipient, uint256 amount);
    event BorrowExecuted(uint256 indexed streamId, address indexed recipient, uint256 requestedAmount, uint256 actualAmount, uint256 borrowShares);
    event DebtRepaid(uint256 indexed streamId, uint256 loanTokenAmount, uint256 remainingDebt);
    event CollateralSwapped(uint256 indexed streamId, address indexed adapter, uint256 collateralAmount, uint256 loanTokenAmount);
    event ClaimSettled(uint256 indexed streamId, address indexed recipient, uint256 grossCollateral, uint256 collateralUsedForDebt, uint256 netCollateralPaid, uint256 debtRepaid);
    event SenderWithdrawal(uint256 indexed streamId, address indexed sender, uint256 collateralAmount);

    // ──────────────────────────── Getters ───────────────────────────────
    function sender() external view returns (address);
    function recipient() external view returns (address);
    function collateralToken() external view returns (address);
    function loanToken() external view returns (address);
    function collateralAmount() external view returns (uint256);
    function startTime() external view returns (uint256);
    function endTime() external view returns (uint256);
    function state() external view returns (StreamState);
    function streamedSoFar() external view returns (uint256);
    function claimedAmount() external view returns (uint256);
    function borrowedAmount() external view returns (uint256);
    function morpho() external view returns (address);

    function getFlowRate() external view returns (uint256);
    function getStreamedAmount() external view returns (uint256);
    function getClaimable() external view returns (uint256);
    function getRemaining() external view returns (uint256);
    function getAvailableToBorrow() external view returns (uint256);
    function getLtv() external view returns (uint256);
    function getDebt() external view returns (uint256 debtAssets, uint128 debtShares);
    function getMorphoPosition() external view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral);
    function getClaimSettlement() external view returns (uint256 grossCollateral, uint256 collateralForDebt, uint256 netCollateral, uint256 currentDebt);
    function isHealthy() external view returns (bool);

    // ──────────────────────────── Actions ───────────────────────────────
    function start() external;
    function pause() external;
    function resume() external;
    function end() external;
    function claim() external;
    function borrow(uint256 amount) external;
    function repay(uint256 amount) external;
    function withdraw() external;
}
