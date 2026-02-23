// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PlayToken} from "../src/PlayToken.sol";

contract PlayTokenTest is Test {
    PlayToken token;
    address deployer;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        deployer = address(this);
        token = new PlayToken();
    }

    function test_metadata() public view {
        assertEq(token.name(), "OSPM Play Token");
        assertEq(token.symbol(), "PLAY");
        assertEq(token.decimals(), 18);
    }

    function test_initialSupply() public view {
        assertEq(token.totalSupply(), 1_000_000e18);
        assertEq(token.balanceOf(deployer), 1_000_000e18);
    }

    function test_faucet() public {
        vm.prank(alice);
        token.faucet();
        assertEq(token.balanceOf(alice), 1_000e18);
    }

    function test_faucetEmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit PlayToken.FaucetClaimed(alice, 1_000e18);
        token.faucet();
    }

    function test_faucetCooldown() public {
        vm.prank(alice);
        token.faucet();

        vm.prank(alice);
        vm.expectRevert("Faucet: cooldown not elapsed");
        token.faucet();
    }

    function test_faucetAfterCooldown() public {
        vm.prank(alice);
        token.faucet();

        vm.warp(block.timestamp + 24 hours);

        vm.prank(alice);
        token.faucet();
        assertEq(token.balanceOf(alice), 2_000e18);
    }

    function test_canClaimFaucet() public {
        assertTrue(token.canClaimFaucet(alice));

        vm.prank(alice);
        token.faucet();
        assertFalse(token.canClaimFaucet(alice));

        vm.warp(block.timestamp + 24 hours);
        assertTrue(token.canClaimFaucet(alice));
    }

    function test_timeUntilNextClaim() public {
        assertEq(token.timeUntilNextClaim(alice), 0);

        vm.prank(alice);
        token.faucet();
        assertEq(token.timeUntilNextClaim(alice), 24 hours);

        vm.warp(block.timestamp + 12 hours);
        assertEq(token.timeUntilNextClaim(alice), 12 hours);

        vm.warp(block.timestamp + 12 hours);
        assertEq(token.timeUntilNextClaim(alice), 0);
    }

    function test_adminMint() public {
        token.adminMint(bob, 500e18);
        assertEq(token.balanceOf(bob), 500e18);
    }

    function test_adminMint_revertNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        token.adminMint(bob, 500e18);
    }

    function test_multipleFaucetUsers() public {
        vm.prank(alice);
        token.faucet();
        vm.prank(bob);
        token.faucet();

        assertEq(token.balanceOf(alice), 1_000e18);
        assertEq(token.balanceOf(bob), 1_000e18);
    }
}
