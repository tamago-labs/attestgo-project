// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * PrimaryMarket — demo primary issuance for GO Asset Management.
 * Pre-fund: rate (NAV price) set at deploy, issuer deposits RWA tokens, users buy with payment token.
 * - rwaToken (aN225 / aTBILL) is GToken (18 dec)
 * - paymentToken (JPYC 18 dec for Nikkei, USDT 6 dec for T-Bill)
 * - price = paymentTokens per 1 RWA (18-dec fixed point, 1e18 = 1:1). NAV price set by issuer at deploy.
 * Flow: deploy(price, paymentToken, rwaToken) -> issuer deposit via deposit(amount) -> user buy(amountRWA) pays price.
 * Issuer can withdraw paymentTokens and unsold RWA.
 */
contract PrimaryMarket is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable rwaToken;
    IERC20 public immutable paymentToken;
    uint256 public price; // payment per 1 RWA, 1e18 = 1:1
    uint8 public immutable rwaDecimals;
    uint8 public immutable payDecimals;

    event Deposited(address indexed issuer, uint256 amount);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event Bought(address indexed buyer, uint256 rwaAmount, uint256 payAmount);
    event Sold(address indexed seller, uint256 rwaAmount, uint256 payAmount);
    event WithdrawnPayment(address indexed to, uint256 amount);
    event WithdrawnRWA(address indexed to, uint256 amount);

    constructor(address rwaToken_, address paymentToken_, uint256 price_) {
        require(rwaToken_ != address(0) && paymentToken_ != address(0), "zero token");
        require(price_ > 0, "price zero");
        rwaToken = IERC20(rwaToken_);
        paymentToken = IERC20(paymentToken_);
        price = price_;
        rwaDecimals = IERC20Metadata(rwaToken_).decimals();
        payDecimals = IERC20Metadata(paymentToken_).decimals();
    }

    function setPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "price zero");
        uint256 old = price;
        price = newPrice;
        emit PriceUpdated(old, newPrice);
    }

    // issuer deposits RWA for sale (must approve first)
    function deposit(uint256 amount) external onlyOwner {
        rwaToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    function payFor(uint256 rwaAmount) public view returns (uint256) {
        // pay = rwaAmount * price / 1e18 adjusted for decimals
        // rwaAmount is in rwaDecimals, price 1e18, result in payDecimals
        // pay = rwaAmount * price * 10^{payDec} / (1e18 * 10^{rwaDec})
        return (rwaAmount * price * (10 ** payDecimals)) / (1e18 * (10 ** rwaDecimals));
    }

    function buy(uint256 rwaAmount) external {
        require(rwaAmount > 0, "amount zero");
        uint256 payAmount = payFor(rwaAmount);
        require(rwaToken.balanceOf(address(this)) >= rwaAmount, "insufficient RWA");
        paymentToken.safeTransferFrom(msg.sender, address(this), payAmount);
        rwaToken.safeTransfer(msg.sender, rwaAmount);
        emit Bought(msg.sender, rwaAmount, payAmount);
    }

    function sell(uint256 rwaAmount) external {
        require(rwaAmount > 0, "amount zero");
        uint256 payAmount = payFor(rwaAmount);
        require(paymentToken.balanceOf(address(this)) >= payAmount, "insufficient payment liquidity");
        rwaToken.safeTransferFrom(msg.sender, address(this), rwaAmount);
        paymentToken.safeTransfer(msg.sender, payAmount);
        emit Sold(msg.sender, rwaAmount, payAmount);
    }

    function withdrawPayment(uint256 amount, address to) external onlyOwner {
        paymentToken.safeTransfer(to, amount);
        emit WithdrawnPayment(to, amount);
    }

    function withdrawRWA(uint256 amount, address to) external onlyOwner {
        rwaToken.safeTransfer(to, amount);
        emit WithdrawnRWA(to, amount);
    }

    function rwaBalance() external view returns (uint256) { return rwaToken.balanceOf(address(this)); }
    function payBalance() external view returns (uint256) { return paymentToken.balanceOf(address(this)); }
}
