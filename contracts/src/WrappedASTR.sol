// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

bytes32 constant USC_MINTER = keccak256("USC_MINTER");

contract WrappedASTR is ERC20, AccessControl, Ownable {
    constructor(address minter) ERC20("Wrapped ASTR", "wASTR") {
        _grantRole(USC_MINTER, minter);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function mint(address to, uint256 amount) external onlyRole(USC_MINTER) {
        _mint(to, amount);
    }

    // OZ v4 Ownable + AccessControl both have no overlap, keep both
    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
