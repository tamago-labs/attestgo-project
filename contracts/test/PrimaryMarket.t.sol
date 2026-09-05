// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Test} from "forge-std/Test.sol";
import {GToken} from "../src/GToken.sol";
import {GOPass} from "../src/GOPass.sol";
import {PrimaryMarket} from "../src/mocks/PrimaryMarket.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockPay is ERC20 {
    uint8 private _dec;
    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) { _dec = d; }
    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 a) external { _mint(to, a); }
}

contract PrimaryMarketTest is Test {
    GOPass hub;
    address owner = address(0xA11CE);
    address issuer = address(0xB055);
    address alice = address(0xA11CE + 1);
    address bob = address(0xB0B);

    MockPay jpyc; // 18 dec for nikkei
    MockPay usdt; // 6 dec for tbill
    GToken aN225;
    GToken aTBILL;
    PrimaryMarket mNikkei;
    PrimaryMarket mTBILL;

    function setUp() public {
        vm.prank(owner);
        hub = new GOPass("https://attestgo.test/pass/");
        vm.prank(owner);
        hub.setWorker(owner);

        jpyc = new MockPay("JPYC", "JPYC", 18);
        usdt = new MockPay("USDT", "USDT", 6);

        // give passes for GToken mint eligibility
        _givePass(issuer, 10, 7); // US+JP+SG bitmap 7 for nikkei
        _givePass(alice, 10, 7); // 7 covers US as well for tbill
        _givePass(bob, 10, 1); // US only for tbill

        GToken.Rule memory rNikkei = GToken.Rule(bytes2(0), bytes2(0), 10, 0, false, 7);
        GToken.Rule memory rTBILL = GToken.Rule(bytes2(0), bytes2(0), 10, 0, false, 1);

        vm.prank(issuer);
        aN225 = new GToken("Go Nikkei 225 Index", "aN225", address(hub), rNikkei, "https://attestgo.tamagolabs.com/nekkei-token-icon.png", address(0));
        vm.prank(issuer);
        aTBILL = new GToken("Go T-Bill", "aTBILL", address(hub), rTBILL, "https://attestgo.tamagolabs.com/t-bill-token-icon.png", address(0));

        // mint 1M to issuer
        vm.prank(issuer);
        aN225.mint(issuer, 1_000_000 ether);
        vm.prank(issuer);
        aTBILL.mint(issuer, 1_000_000 ether);

        // pre-fund price 1e18 = 1:1 NAV
        mNikkei = new PrimaryMarket(address(aN225), address(jpyc), 1e18);
        mTBILL = new PrimaryMarket(address(aTBILL), address(usdt), 1e18);

        // market must be eligible to hold/receive GToken (transfer checks both sides)
        _givePass(address(mNikkei), 10, 7);
        _givePass(address(mTBILL), 10, 1);

        // transfer ownership to issuer so only issuer can deposit/withdraw
        mNikkei.transferOwnership(issuer);
        mTBILL.transferOwnership(issuer);

        // issuer deposits 100k each
        vm.prank(issuer);
        aN225.approve(address(mNikkei), 100_000 ether);
        vm.prank(issuer);
        mNikkei.deposit(100_000 ether);

        vm.prank(issuer);
        aTBILL.approve(address(mTBILL), 100_000 ether);
        vm.prank(issuer);
        mTBILL.deposit(100_000 ether);

        // fund alice/bob with payment tokens
        jpyc.mint(alice, 1_000_000 ether);
        usdt.mint(bob, 1_000_000 * 1e6);
    }

    function _givePass(address who, uint8 tier, uint256 bitmap) internal {
        GOPass.Record memory r = GOPass.Record(tier, 0, 0, 0, bitmap, uint64(block.timestamp + 365 days), false, false, keccak256(abi.encodePacked(who)), "");
        vm.prank(owner);
        hub.mint(who, r);
        vm.prank(owner);
        hub.setActive(who, true);
    }

    function test_buy_nikkei_jpyc() public {
        // alice buys 100 aN225 with 100 JPYC (1:1)
        vm.prank(alice);
        jpyc.approve(address(mNikkei), 100 ether);
        vm.prank(alice);
        mNikkei.buy(100 ether);
        assertEq(aN225.balanceOf(alice), 100 ether);
        assertEq(jpyc.balanceOf(address(mNikkei)), 100 ether);
    }

    function test_buy_tbill_usdt_6dec() public {
        // bob buys 100 aTBILL with 100 USDT (6 dec vs 18 dec)
        // payFor(100 ether) = 100e18 *1e18 *1e6 / (1e18*1e18) = 100e6
        vm.prank(bob);
        usdt.approve(address(mTBILL), 100 * 1e6);
        vm.prank(bob);
        mTBILL.buy(100 ether);
        assertEq(aTBILL.balanceOf(bob), 100 ether);
        assertEq(usdt.balanceOf(address(mTBILL)), 100 * 1e6);
    }

    function test_price_update() public {
        vm.prank(issuer);
        mNikkei.setPrice(1.02e18); // NAV 1.02
        // 100 aN225 now costs 102 JPYC
        vm.prank(alice);
        jpyc.approve(address(mNikkei), 102 ether);
        vm.prank(alice);
        mNikkei.buy(100 ether);
        assertEq(jpyc.balanceOf(address(mNikkei)), 102 ether);
    }

    function test_onlyOwner_deposit() public {
        vm.prank(alice);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        mNikkei.deposit(1 ether);
    }

    function test_reverts_insufficient_rwa() public {
        vm.prank(alice);
        jpyc.approve(address(mNikkei), 200_000 ether);
        vm.prank(alice);
        vm.expectRevert(bytes("insufficient RWA"));
        mNikkei.buy(200_000 ether);
    }
}
