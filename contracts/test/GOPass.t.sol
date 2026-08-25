// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Test} from "forge-std/Test.sol";
import {GOPass} from "../src/GOPass.sol";
import {GOPassVerifier} from "../src/GOPassVerifier.sol";
import {GToken} from "../src/GToken.sol";

contract GOPassTest is Test {
    GOPass hub;
    GOPassVerifier mirror;
    GToken gtoken;

    address owner = address(0xA11CE);
    address worker = address(0xB0B);
    address alice = address(0x2c1A);
    address bob = address(0xB0B0);
    address stranger = address(0xBAD);

    function setUp() public {
        vm.prank(owner);
        hub = new GOPass("https://attestgo.test/pass/");
        // hub is on CC3 102031, mirror on dest chains references it
        mirror = new GOPassVerifier(address(hub), 102031);
        vm.prank(mirror.owner());
        mirror.setWorker(worker);
        GOPassVerifier.Rule memory baseRule = GOPassVerifier.Rule({
            allowed_group: bytes2(0),
            allowed_sub_group: bytes2(0),
            min_tier: 10,
            min_sub_tier: 0,
            is_black_list: false,
            countriesBitmap: uint256(1) << 0 | uint256(1) << 1 // US=0 SG=1
        });
        GToken.Rule memory gr = GToken.Rule({
            allowed_group: baseRule.allowed_group,
            allowed_sub_group: baseRule.allowed_sub_group,
            min_tier: baseRule.min_tier,
            min_sub_tier: baseRule.min_sub_tier,
            is_black_list: baseRule.is_black_list,
            countriesBitmap: baseRule.countriesBitmap
        });
        gtoken = new GToken("USD T-Bill", "USD-TBILL", address(mirror), gr, "https://icons.test/usd-tbill.svg");
        // transfer GToken ownership to owner for gated mint
        gtoken.transferOwnership(owner);
    }

    function _rec(uint8 tier, uint256 bitmap, uint64 expiry, bool frozen, bytes32 cid) internal pure returns (GOPass.Record memory) {
        return GOPass.Record({tier: tier, subTier: 0, group: 0, subGroup: 0, countryBitmap: bitmap, expiry: expiry, frozen: frozen, customerIdHash: cid});
    }

    function _mirrorRec(uint8 tier, uint256 bitmap, uint64 expiry, bool frozen, bytes32 cid) internal pure returns (GOPassVerifier.Record memory) {
        return GOPassVerifier.Record({tier: tier, subTier: 0, group: 0, subGroup: 0, countryBitmap: bitmap, expiry: expiry, frozen: frozen, customerIdHash: cid});
    }

    // ---- GOPass hub ----
    function test_mint_success() public {
        uint64 exp = uint64(block.timestamp + 365 days);
        GOPass.Record memory r = _rec(10, 3, exp, false, keccak256("cust1"));
        vm.prank(owner);
        hub.mint(alice, r);
        assertEq(hub.ownerOf(uint160(alice)), alice);
        assertTrue(hub.hasPass(alice));
        assertEq(hub.recordHash(alice), keccak256(abi.encode(r)));
    }

    function test_mint_reverts() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        GOPass.Record memory r = _rec(10, 3, exp, false, keccak256("c1"));
        vm.prank(stranger);
        vm.expectRevert();
        hub.mint(alice, r);
        vm.prank(owner);
        hub.mint(alice, r);
        vm.prank(owner);
        vm.expectRevert(bytes("already minted"));
        hub.mint(alice, r);
        vm.prank(owner);
        vm.expectRevert(bytes("customerId used"));
        hub.mint(bob, _rec(10, 3, exp, false, keccak256("c1")));
        vm.prank(owner);
        vm.expectRevert(bytes("to zero"));
        hub.mint(address(0), _rec(10, 3, exp, false, keccak256("c2")));
        vm.prank(owner);
        vm.expectRevert(bytes("expiry past"));
        hub.mint(bob, _rec(10, 3, uint64(block.timestamp - 1), false, keccak256("c2")));
    }

    function test_soulbound() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.prank(owner);
        hub.mint(alice, _rec(10, 3, exp, false, keccak256("c1")));
        vm.prank(alice);
        vm.expectRevert(bytes("soulbound: non-transferable"));
        hub.transferFrom(alice, bob, uint160(alice));
    }

    function test_update_and_freeze() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.prank(owner);
        hub.mint(alice, _rec(10, 3, exp, false, keccak256("c1")));
        GOPass.Record memory r2 = _rec(30, 1, exp, false, keccak256("c1"));
        vm.prank(owner);
        hub.update(alice, r2);
        assertEq(hub.recordHash(alice), keccak256(abi.encode(r2)));
        vm.prank(owner);
        hub.setFrozen(alice, true);
        assertTrue(hub.getRecord(alice).frozen);
        vm.prank(owner);
        hub.setFrozen(alice, false);
        assertFalse(hub.getRecord(alice).frozen);
    }

    function test_burn() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.prank(owner);
        hub.mint(alice, _rec(10, 3, exp, false, keccak256("c1")));
        vm.prank(owner);
        hub.burn(alice);
        assertFalse(hub.hasPass(alice));
        vm.expectRevert();
        hub.ownerOf(uint160(alice));
    }

    // ---- Mirror ----
    function test_mirror_markVerified_and_eligible() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        GOPassVerifier.Record memory r = _mirrorRec(11, 3, exp, false, keccak256("c1"));
        vm.prank(worker);
        mirror.markVerified(alice, r);
        GOPassVerifier.Rule memory rule = GOPassVerifier.Rule(bytes2(0), bytes2(0), 10, 0, false, 3);
        assertTrue(mirror.isEligible(alice, rule));
        // tier too low
        rule.min_tier = 20;
        assertFalse(mirror.isEligible(alice, rule));
        rule.min_tier = 10;
        // whitelist mismatch
        rule.countriesBitmap = uint256(1) << 2; // JP only
        assertFalse(mirror.isEligible(alice, rule));
        // blacklist
        rule.countriesBitmap = 3;
        rule.is_black_list = true;
        assertFalse(mirror.isEligible(alice, rule)); // has US|SG so blocked
    }

    function test_mirror_expiry_and_invalidate() public {
        uint64 exp = uint64(block.timestamp + 100);
        GOPassVerifier.Record memory r = _mirrorRec(11, 3, exp, false, keccak256("c1"));
        vm.prank(worker);
        mirror.markVerified(alice, r);
        GOPassVerifier.Rule memory rule = GOPassVerifier.Rule(bytes2(0), bytes2(0), 10, 0, false, 3);
        assertTrue(mirror.isEligible(alice, rule));
        vm.warp(block.timestamp + 101);
        assertFalse(mirror.isEligible(alice, rule)); // expired
        vm.warp(block.timestamp - 101);
        vm.prank(worker);
        mirror.markVerified(alice, r);
        vm.warp(block.timestamp + 25 hours);
        assertFalse(mirror.isEligible(alice, rule)); // verifiedUntil expired (24h)
        vm.warp(block.timestamp - 25 hours);
        vm.prank(worker);
        mirror.invalidate(alice);
        assertFalse(mirror.isEligible(alice, rule));
    }

    function test_mirror_onlyWorkerOrOwner() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.prank(stranger);
        vm.expectRevert(bytes("only worker/owner"));
        mirror.markVerified(alice, _mirrorRec(11, 3, exp, false, keccak256("c1")));
    }

    // ---- GToken gated ----
    function test_gtoken_mint_transfer_gated() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        GOPassVerifier.Record memory r = _mirrorRec(11, 3, exp, false, keccak256("c1"));
        vm.prank(worker);
        mirror.markVerified(alice, r);
        vm.prank(owner);
        gtoken.mint(alice, 1000 ether);
        assertEq(gtoken.balanceOf(alice), 1000 ether);
        // bob not eligible -> mint fails
        vm.prank(owner);
        vm.expectRevert(bytes("PassNotEligible"));
        gtoken.mint(bob, 100 ether);
        // transfer to ineligible fails
        vm.prank(alice);
        vm.expectRevert(bytes("PassNotEligible"));
        gtoken.transfer(bob, 10 ether);
        // make bob eligible then transfer works
        vm.prank(worker);
        mirror.markVerified(bob, _mirrorRec(11, 3, exp, false, keccak256("c2")));
        vm.prank(alice);
        gtoken.transfer(bob, 10 ether);
        assertEq(gtoken.balanceOf(bob), 10 ether);
    }

    function test_gtoken_paused() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.prank(worker);
        mirror.markVerified(alice, _mirrorRec(11, 3, exp, false, keccak256("c1")));
        vm.prank(owner);
        gtoken.setPaused(true);
        vm.prank(owner);
        vm.expectRevert(bytes("paused"));
        gtoken.mint(alice, 10 ether);
    }
}
