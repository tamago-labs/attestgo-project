// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {GOPassVerifier} from "./GOPassVerifier.sol";

/**
 * GToken — example compliant RWA (USD T-Bill) gated by GOPassVerifier
 * Enforces the same Rule shape as Cleanverse atoken/launch (allowed_group, min_tier, countriesBitmap).
 * Uses verifier.isEligible for every mint/burn/transfer (checks both from and to).
 */
contract GToken is ERC20, Ownable {
    GOPassVerifier public immutable verifier;
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

    constructor(string memory name_, string memory symbol_, address verifierAddr, Rule memory rule_, string memory iconURI_) ERC20(name_, symbol_) {
        require(verifierAddr != address(0), "verifier zero");
        verifier = GOPassVerifier(verifierAddr);
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

    function _ruleForVerifier() internal view returns (GOPassVerifier.Rule memory) {
        return GOPassVerifier.Rule({
            allowed_group: rule.allowed_group,
            allowed_sub_group: rule.allowed_sub_group,
            min_tier: rule.min_tier,
            min_sub_tier: rule.min_sub_tier,
            is_black_list: rule.is_black_list,
            countriesBitmap: rule.countriesBitmap
        });
    }

    function _checkEligible(address wallet) internal view {
        // All holders must be eligible. Zero-address (mint/burn) is bypassed.
        if (wallet == address(0)) return;
        require(verifier.isEligible(wallet, _ruleForVerifier()), "PassNotEligible");
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
