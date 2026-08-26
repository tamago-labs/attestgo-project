// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IGOPassEligible {
    struct Rule {
        bytes2 allowed_group;
        bytes2 allowed_sub_group;
        uint8 min_tier;
        uint8 min_sub_tier;
        bool is_black_list;
        uint256 countriesBitmap;
    }
    function isEligible(address wallet, Rule calldata rule) external view returns (bool);
}

/**
 * GToken — compliant ERC20 gated by GOPass / GOPassMirror. Two modes via factory:
 * - native: underlying == 0 -> mint/burn by owner, like RWA T-Bill
 * - wrapped: underlying !=0 -> wrap/unwrap 1:1 underlying, decimals mirrors underlying
 * Factory indexes both and sets token owner = creator (msg.sender).
 */
contract GToken is ERC20, Ownable {
    using SafeERC20 for IERC20;

    address public immutable eligibleProvider;
    address public immutable underlying; // 0 = native, else wrapped ERC20
    uint8 private immutable _underlyingDecimals;
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
    event Wrap(address indexed user, uint256 amount);
    event Unwrap(address indexed user, uint256 amount);

    modifier whenNotPaused() {
        require(!paused, "paused");
        _;
    }

    constructor(string memory name_, string memory symbol_, address providerAddr, Rule memory rule_, string memory iconURI_, address underlying_) ERC20(name_, symbol_) {
        require(providerAddr != address(0), "provider zero");
        eligibleProvider = providerAddr;
        underlying = underlying_;
        _underlyingDecimals = underlying_ != address(0) ? IERC20Metadata(underlying_).decimals() : 18;
        rule = rule_;
        gIconURI = iconURI_;
    }

    function decimals() public view override returns (uint8) {
        return underlying != address(0) ? _underlyingDecimals : 18;
    }

    function isWrapped() public view returns (bool) {
        return underlying != address(0);
    }

    function setRule(Rule calldata r) external onlyOwner {
        rule = r;
        emit RuleUpdated(r);
    }

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PausedSet(p);
    }

    function _ruleForProvider() internal view returns (IGOPassEligible.Rule memory) {
        return IGOPassEligible.Rule({
            allowed_group: rule.allowed_group,
            allowed_sub_group: rule.allowed_sub_group,
            min_tier: rule.min_tier,
            min_sub_tier: rule.min_sub_tier,
            is_black_list: rule.is_black_list,
            countriesBitmap: rule.countriesBitmap
        });
    }

    function _checkEligible(address wallet) internal view {
        if (wallet == address(0)) return;
        require(IGOPassEligible(eligibleProvider).isEligible(wallet, _ruleForProvider()), "PassNotEligible");
    }

    // native mint — only when not wrapped
    function mint(address to, uint256 amount) external onlyOwner whenNotPaused {
        require(underlying == address(0), "wrapped: use wrap");
        _checkEligible(to);
        _mint(to, amount);
    }

    function burn(uint256 amount) external whenNotPaused {
        _burn(msg.sender, amount);
    }

    // wrapped mode
    function wrap(uint256 amount) external whenNotPaused {
        require(underlying != address(0), "not wrapped");
        require(amount > 0, "amount zero");
        _checkEligible(msg.sender);
        IERC20(underlying).safeTransferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
        emit Wrap(msg.sender, amount);
    }

    function wrapTo(address to, uint256 amount) external whenNotPaused {
        require(underlying != address(0), "not wrapped");
        require(amount > 0, "amount zero");
        require(to != address(0), "to zero");
        _checkEligible(msg.sender);
        _checkEligible(to);
        IERC20(underlying).safeTransferFrom(msg.sender, address(this), amount);
        _mint(to, amount);
        emit Wrap(to, amount);
    }

    function unwrap(uint256 amount) external whenNotPaused {
        require(underlying != address(0), "not wrapped");
        require(amount > 0, "amount zero");
        _checkEligible(msg.sender);
        _burn(msg.sender, amount);
        IERC20(underlying).safeTransfer(msg.sender, amount);
        emit Unwrap(msg.sender, amount);
    }

    function unwrapTo(address to, uint256 amount) external whenNotPaused {
        require(underlying != address(0), "not wrapped");
        require(amount > 0, "amount zero");
        require(to != address(0), "to zero");
        _checkEligible(msg.sender);
        _checkEligible(to);
        _burn(msg.sender, amount);
        IERC20(underlying).safeTransfer(to, amount);
        emit Unwrap(to, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override whenNotPaused {
        if (from != address(0)) _checkEligible(from);
        if (to != address(0)) _checkEligible(to);
        super._beforeTokenTransfer(from, to, amount);
    }
}
