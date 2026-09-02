// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;

import {Id} from "./IMorpho.sol";

/// @title IRemoteCollateralManager
/// @notice Implemented by CoreVault (Creditcoin). Morpho notifies it when remote collateral is
///         seized in a liquidation, so the claim can be settled on the source chain later.
interface IRemoteCollateralManager {
    /// @notice Called by Morpho after remote collateral was seized from `borrower` by `liquidator`.
    function onRemoteSeized(Id id, address borrower, address liquidator, uint256 assets) external;
}
