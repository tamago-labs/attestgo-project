// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Test} from "forge-std/Test.sol";
import {GOPass} from "../src/GOPass.sol";
import {GOPassRegistry} from "../src/GOPassRegistry.sol";
import {GToken} from "../src/GToken.sol";

contract GOPassTest is Test {
    GOPass hub;
    GOPassRegistry registry;
    GToken gtoken;

    address owner = address(0xA11CE);
    address alice = address(0x2c1A);
    address bob = address(0xB0B0);
    address stranger = address(0xBAD);

    function setUp() public {
        vm.prank(owner);
        hub = new GOPass("https://attestgo.test/pass/");
        registry = new GOPassRegistry(address(hub), 1);
        GOPass.Rule memory baseRule = GOPass.Rule({
            allowed_group: bytes2(0),
            allowed_sub_group: bytes2(0),
            min_tier: 10,
            min_sub_tier: 0,
            is_black_list: false,
            countriesBitmap: uint256(1) << 0 | uint256(1) << 1
        });
        gtoken = new GToken("USD T-Bill", "USD-TBILL", address(hub), GToken.Rule(baseRule.allowed_group, baseRule.allowed_sub_group, baseRule.min_tier, baseRule.min_sub_tier, baseRule.is_black_list, baseRule.countriesBitmap), "https://icons.test/usd-tbill.svg", address(0));
        gtoken.transferOwnership(owner);
        vm.prank(owner);
        hub.setWorker(owner);
    }

    function _rec(uint8 tier, uint256 bitmap, uint64 expiry, bool frozen, bytes32 cid) internal pure returns (GOPass.Record memory) {
        return GOPass.Record({tier: tier, subTier: 0, group: 0, subGroup: 0, countryBitmap: bitmap, expiry: expiry, frozen: frozen, active: false, customerIdHash: cid, kycSource: ""});
    }

    function _regRec(uint8 tier, uint256 bitmap, uint64 expiry, bool frozen, bytes32 cid) internal pure returns (GOPassRegistry.Record memory) {
        return GOPassRegistry.Record({tier: tier, subTier: 0, group: 0, subGroup: 0, countryBitmap: bitmap, expiry: expiry, frozen: frozen, active: false, customerIdHash: cid, kycSource: ""});
    }

    function test_mint_pending_not_eligible() public {
        uint64 exp = uint64(block.timestamp + 365 days);
        vm.prank(owner);
        hub.mint(alice, _rec(10, 1, exp, false, keccak256("cust1")));
        assertEq(hub.ownerOf(uint160(alice)), alice);
        assertFalse(hub.getRecord(alice).active);
        GOPass.Rule memory rule = GOPass.Rule(bytes2(0), bytes2(0), 10, 0, false, 1);
        assertFalse(hub.isEligible(alice, rule));
        vm.prank(owner);
        hub.setActive(alice, true);
        assertTrue(hub.isEligible(alice, rule));
    }

    function test_mint_reverts() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.prank(stranger);
        vm.expectRevert();
        hub.mint(alice, _rec(10, 1, exp, false, keccak256("c1")));
        vm.prank(owner);
        hub.mint(alice, _rec(10, 1, exp, false, keccak256("c1")));
        vm.prank(owner);
        vm.expectRevert(bytes("already minted"));
        hub.mint(alice, _rec(10, 1, exp, false, keccak256("c1")));
        vm.prank(owner);
        vm.expectRevert(bytes("customerId used"));
        hub.mint(bob, _rec(10, 1, exp, false, keccak256("c1")));
    }

    function test_soulbound() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.prank(owner);
        hub.mint(alice, _rec(10, 1, exp, false, keccak256("c1")));
        vm.prank(alice);
        vm.expectRevert(bytes("soulbound: non-transferable"));
        hub.transferFrom(alice, bob, uint160(alice));
    }

    function test_update_and_freeze_and_active() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.prank(owner);
        hub.mint(alice, _rec(10, 1, exp, false, keccak256("c1")));
        vm.prank(owner);
        hub.setActive(alice, true);
        assertTrue(hub.getRecord(alice).active);
        vm.prank(owner);
        hub.setFrozen(alice, true);
        assertTrue(hub.getRecord(alice).frozen);
        GOPass.Rule memory rule = GOPass.Rule(bytes2(0), bytes2(0), 10, 0, false, 1);
        assertFalse(hub.isEligible(alice, rule));
    }

    function test_burn() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.prank(owner);
        hub.mint(alice, _rec(10, 1, exp, false, keccak256("c1")));
        vm.prank(owner);
        hub.burn(alice);
        assertFalse(hub.hasPass(alice));
    }

    function test_registry_sync() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        GOPassRegistry.Record memory r = _regRec(10, 1, exp, false, keccak256("c1"));
        registry.syncPass(alice, r, hex"01");
        GOPassRegistry.Rule memory rule = GOPassRegistry.Rule(bytes2(0), bytes2(0), 10, 0, false, 1);
        assertTrue(registry.isEligible(alice, rule));
        rule.min_tier = 11;
        assertFalse(registry.isEligible(alice, rule));
    }

    function test_gtoken_gated_by_active() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.prank(owner);
        hub.mint(alice, _rec(10, 1, exp, false, keccak256("c1")));
        vm.prank(owner);
        vm.expectRevert(bytes("PassNotEligible"));
        gtoken.mint(alice, 100 ether);
        vm.prank(owner);
        hub.setActive(alice, true);
        vm.prank(owner);
        gtoken.mint(alice, 100 ether);
        assertEq(gtoken.balanceOf(alice), 100 ether);
    }
}
