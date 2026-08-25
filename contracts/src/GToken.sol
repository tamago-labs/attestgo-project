// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {GOPassMirror} from "./GOPassMirror.sol";

/**
 * GToken — example compliant RWA (USD T-Bill) gated by GOPassMirror like AuxiliaryAdvance vault
 * Mirrors Cleanverse atoken/launch rule + AuxiliaryAdvance.authorized flow.
 * Uses GOPassMirror.isEligibleCached for every mint/burn/transfer (check both from/to where applicable).
 */
contract GToken is ERC20, Ownable {
    GOPassMirror public immutable mirror;
    string public gIconURI;

    struct Rule {
        bytes2 allowed_group;
        bytes2 allowed_sub_group;
        uint8 min_tier;
        uint8 min_sub_tier;
        bool is_black_list;
        uint256 countriesBitmap;
    }

    Rule public rule;
    bool public paused;

    event RuleUpdated(Rule rule);
    event PausedSet(bool paused);

    modifier whenNotPaused() {
        require(!paused, "paused");
        _;
    }

    constructor(string memory name_, string memory symbol_, address mirrorAddr, Rule memory rule_, string memory iconURI_) ERC20(name_, symbol_) {
        require(mirrorAddr != address(0), "mirror zero");
        mirror = GOPassMirror(mirrorAddr);
        rule = rule_;
        gIconURI = iconURI_;
    }

    function setRule(Rule calldata r) external onlyOwner {
        rule = r;
        emit RuleUpdated(r);
    }

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PausedSet(p);
    }

    function _ruleForMirror() internal view returns (GOPassMirror.Rule memory) {
        return GOPassMirror.Rule({
            allowed_group: rule.allowed_group,
            allowed_sub_group: rule.allowed_sub_group,
            min_tier: rule.min_tier,
            min_sub_tier: rule.min_sub_tier,
            is_black_list: rule.is_black_list,
            countriesBitmap: rule.countriesBitmap
        });
    }

    function _checkEligible(address wallet) internal view {
        // owner/admin exempt for mint setup? No — even owner must be eligible unless we allow initial holder bypass once.
        // Keep strict: all holders must be eligible (like Cleanverse). Use mirror bypass for zero-address.
        if (wallet == address(0)) return;
        require(mirror.isEligibleCached(wallet, _ruleForMirror()), "PassNotEligible");
    }

    // Compliance-gated mint — like atoken launch after admin grants MINTER_ROLE (here onlyOwner)
    function mint(address to, uint256 amount) external onlyOwner whenNotPaused {
        _checkEligible(to);
        _mint(to, amount);
    }

    function burn(uint256 amount) external whenNotPaused {
        _burn(msg.sender, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override whenNotPaused {
        // allow mint/burn from==0 or to==0 already checked in mint/burn; here check both if transfer
        if (from != address(0)) _checkEligible(from);
        if (to != address(0)) _checkEligible(to);
        super._beforeTokenTransfer(from, to, amount);
    }
}
