// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Test} from "forge-std/Test.sol";
import {GOPass} from "../src/GOPass.sol";
import {GToken} from "../src/GToken.sol";
import {GTokenFactory} from "../src/GTokenFactory.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

contract GTokenFactoryTest is Test {
    GOPass hub;
    GTokenFactory factory;
    MockERC20 usdc;

    address owner = address(0xA11CE);
    address alice = address(0x2c1A);
    address bob = address(0xB0B0);
    address stranger = address(0xBAD);

    function setUp() public {
        vm.prank(owner);
        hub = new GOPass("https://attestgo.test/pass/");
        vm.prank(owner);
        hub.setWorker(owner);
        vm.prank(owner);
        factory = new GTokenFactory(address(hub));
        // usdc 6 decimals like real
        usdc = new MockERC20("USDC", "USDC");
    }

    function _givePass(address who, uint8 tier, uint256 bitmap) internal {
        uint64 exp = uint64(block.timestamp + 365 days);
        GOPass.Record memory r = GOPass.Record(tier, 0, 0, 0, bitmap, exp, false, false, keccak256(abi.encodePacked(who)), "");
        vm.prank(owner);
        hub.mint(who, r);
        vm.prank(owner);
        hub.setActive(who, true);
    }

    function _rule(uint256 bitmap) internal pure returns (GToken.Rule memory) {
        return GToken.Rule(bytes2(0), bytes2(0), 10, 0, false, bitmap);
    }

    function test_factory_createNative_indexes() public {
        vm.prank(alice);
        address token = factory.createGToken("USD T-Bill", "TBILL", _rule(1), "https://icons.test/tbill.svg");
        assertTrue(factory.isGToken(token));
        assertEq(factory.underlyingOf(token), address(0));
        assertEq(factory.creatorOf(token), alice);
        assertEq(factory.allTokensLength(), 1);
        assertEq(factory.allTokens(0), token);
        assertEq(factory.getTokensByCreator(alice).length, 1);
        assertFalse(factory.isWrapped(token));
        // owner is creator not factory
        assertEq(GToken(token).owner(), alice);
        assertEq(GToken(token).underlying(), address(0));
        assertEq(GToken(token).decimals(), 18);
    }

    function test_factory_createWrapped_indexes() public {
        vm.prank(alice);
        address token = factory.createWrappedGToken(address(usdc), "wUSDC", "wUSDC", _rule(1), "");
        assertTrue(factory.isGToken(token));
        assertEq(factory.underlyingOf(token), address(usdc));
        assertTrue(factory.isWrapped(token));
        assertEq(GToken(token).underlying(), address(usdc));
        assertEq(GToken(token).decimals(), 18); // MockERC20 default 18; test 6-dec case separately if needed
        assertEq(GToken(token).owner(), alice);
    }

    function test_native_mint_gated() public {
        _givePass(alice, 10, 1);
        vm.prank(alice);
        address token = factory.createGToken("TBILL", "TBILL", _rule(1), "");
        // stranger no pass -> revert
        vm.prank(alice);
        vm.expectRevert(bytes("PassNotEligible"));
        GToken(token).mint(stranger, 100 ether);
        // alice eligible -> ok
        vm.prank(alice);
        GToken(token).mint(alice, 100 ether);
        assertEq(GToken(token).balanceOf(alice), 100 ether);
    }

    function test_wrapped_wrap_unwrap() public {
        _givePass(alice, 10, 1);
        usdc.mint(alice, 1000 ether);
        vm.prank(alice);
        address token = factory.createWrappedGToken(address(usdc), "wUSDC", "wUSDC", _rule(1), "");
        GToken g = GToken(token);
        vm.prank(alice);
        usdc.approve(token, 100 ether);
        vm.prank(alice);
        g.wrap(50 ether);
        assertEq(g.balanceOf(alice), 50 ether);
        assertEq(usdc.balanceOf(token), 50 ether);
        // transfer gated - bob no pass -> revert
        vm.prank(alice);
        vm.expectRevert(bytes("PassNotEligible"));
        g.transfer(bob, 10 ether);
        // give bob pass then transfer ok
        _givePass(bob, 10, 1);
        vm.prank(alice);
        g.transfer(bob, 10 ether);
        assertEq(g.balanceOf(bob), 10 ether);
        // unwrap
        vm.prank(bob);
        g.unwrap(5 ether);
        assertEq(g.balanceOf(bob), 5 ether);
        assertEq(usdc.balanceOf(bob), 5 ether);
    }

    function test_wrapped_wrap_fails_if_not_eligible() public {
        usdc.mint(stranger, 100 ether);
        vm.prank(alice);
        address token = factory.createWrappedGToken(address(usdc), "wUSDC", "wUSDC", _rule(1), "");
        vm.prank(stranger);
        usdc.approve(token, 10 ether);
        vm.prank(stranger);
        vm.expectRevert(bytes("PassNotEligible"));
        GToken(token).wrap(10 ether);
    }

    function test_wrapped_native_mint_disabled() public {
        _givePass(alice, 10, 1);
        vm.prank(alice);
        address token = factory.createWrappedGToken(address(usdc), "wUSDC", "wUSDC", _rule(1), "");
        vm.prank(alice);
        vm.expectRevert(bytes("wrapped: use wrap"));
        GToken(token).mint(alice, 10 ether);
    }

    function test_factory_provider_update() public {
        address newProvider = address(0x999);
        vm.prank(owner);
        factory.transferOwnership(alice);
        vm.prank(alice);
        factory.setProvider(newProvider);
        assertEq(factory.eligibleProvider(), newProvider);
    }
}
