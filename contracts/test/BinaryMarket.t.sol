// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PlayToken} from "../src/PlayToken.sol";
import {BinaryMarket} from "../src/BinaryMarket.sol";
import {LMSR} from "../src/LMSR.sol";

contract BinaryMarketTest is Test {
    PlayToken token;
    BinaryMarket market;

    address oracleAddr = makeAddr("oracle");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant B = 100e18;
    uint256 bettingClose;
    uint256 resolution;

    function setUp() public {
        token = new PlayToken();
        bettingClose = block.timestamp + 1 days;
        resolution = block.timestamp + 2 days;

        market = new BinaryMarket(
            address(token),
            oracleAddr,
            "Will it rain tomorrow?",
            "https://weather.com",
            bettingClose,
            resolution,
            B
        );

        // Fund market with subsidy (b * 0.7 ≈ 70 PLAY)
        token.transfer(address(market), (B * 7) / 10);

        // Fund users
        token.adminMint(alice, 10_000e18);
        token.adminMint(bob, 10_000e18);

        // Users approve market
        vm.prank(alice);
        token.approve(address(market), type(uint256).max);
        vm.prank(bob);
        token.approve(address(market), type(uint256).max);
    }

    // ── Read ─────────────────────────────────────────────────────────────

    function test_initialOdds() public view {
        (uint256 pYes, uint256 pNo) = market.getOdds();
        assertApproxEqRel(pYes, 0.5e18, 0.001e18);
        assertApproxEqRel(pNo, 0.5e18, 0.001e18);
    }

    function test_costToBuy() public view {
        uint256 c = market.costToBuy(true, 10e18);
        assertTrue(c > 0);
    }

    // ── Betting ──────────────────────────────────────────────────────────

    function test_placeBet() public {
        vm.prank(alice);
        uint256 shares = market.placeBet(true, 50e18);
        assertTrue(shares > 0);

        (uint256 s, bool outcome, uint256 costBasis, bool claimed) = market.bets(alice);
        assertEq(s, shares);
        assertTrue(outcome);
        assertTrue(costBasis > 0);
        assertFalse(claimed);
    }

    function test_betUpdatesOdds() public {
        (uint256 pYesBefore,) = market.getOdds();

        vm.prank(alice);
        market.placeBet(true, 100e18);

        (uint256 pYesAfter,) = market.getOdds();
        assertTrue(pYesAfter > pYesBefore);
    }

    function test_onlyOneBetPerAddress() public {
        vm.prank(alice);
        market.placeBet(true, 50e18);

        vm.prank(alice);
        vm.expectRevert("Already placed bet");
        market.placeBet(false, 50e18);
    }

    function test_bettingClosesAtTimestamp() public {
        vm.warp(bettingClose);

        vm.prank(alice);
        vm.expectRevert("Betting closed");
        market.placeBet(true, 50e18);
    }

    function test_betRequiresNonZero() public {
        vm.prank(alice);
        vm.expectRevert("Amount must be > 0");
        market.placeBet(true, 0);
    }

    // ── Resolution ───────────────────────────────────────────────────────

    function test_onlyOracleResolves() public {
        vm.warp(resolution);

        vm.prank(alice);
        vm.expectRevert("Only oracle");
        market.proposeResolution(true);
    }

    function test_cannotResolveTooEarly() public {
        vm.prank(oracleAddr);
        vm.expectRevert("Too early to resolve");
        market.proposeResolution(true);
    }

    function test_proposeResolution() public {
        vm.warp(resolution);

        vm.prank(oracleAddr);
        market.proposeResolution(true);

        assertEq(uint256(market.status()), uint256(BinaryMarket.Status.PROPOSED));
        assertTrue(market.resolvedOutcome());
    }

    function test_finalizeAfterDisputeWindow() public {
        vm.warp(resolution);
        vm.prank(oracleAddr);
        market.proposeResolution(true);

        vm.warp(block.timestamp + 2 hours);
        market.finalizeResolution();

        assertEq(uint256(market.status()), uint256(BinaryMarket.Status.RESOLVED));
    }

    function test_cannotFinalizeDuringDisputeWindow() public {
        vm.warp(resolution);
        vm.prank(oracleAddr);
        market.proposeResolution(true);

        vm.expectRevert("Dispute window active");
        market.finalizeResolution();
    }

    // ── Disputes ─────────────────────────────────────────────────────────

    function test_dispute() public {
        vm.prank(alice);
        market.placeBet(true, 50e18);

        vm.warp(resolution);
        vm.prank(oracleAddr);
        market.proposeResolution(false);

        vm.prank(alice);
        market.disputeResolution("Wrong outcome");

        assertEq(uint256(market.status()), uint256(BinaryMarket.Status.DISPUTED));
    }

    function test_disputeRequiresBet() public {
        vm.warp(resolution);
        vm.prank(oracleAddr);
        market.proposeResolution(true);

        vm.prank(alice);
        vm.expectRevert("Must have bet to dispute");
        market.disputeResolution("I disagree");
    }

    function test_disputeWindowClosed() public {
        vm.prank(alice);
        market.placeBet(true, 50e18);

        vm.warp(resolution);
        vm.prank(oracleAddr);
        market.proposeResolution(false);

        vm.warp(block.timestamp + 2 hours);

        vm.prank(alice);
        vm.expectRevert("Dispute window closed");
        market.disputeResolution("Too late");
    }

    function test_repropose_afterDispute() public {
        vm.prank(alice);
        market.placeBet(true, 50e18);

        vm.warp(resolution);
        vm.prank(oracleAddr);
        market.proposeResolution(false);

        vm.prank(alice);
        market.disputeResolution("Wrong");

        // Oracle can re-propose after dispute
        vm.prank(oracleAddr);
        market.proposeResolution(true);
        assertEq(uint256(market.status()), uint256(BinaryMarket.Status.PROPOSED));
        assertTrue(market.resolvedOutcome());
    }

    // ── Claims ───────────────────────────────────────────────────────────

    function test_claimWinnings() public {
        // Alice bets YES, Bob bets NO
        vm.prank(alice);
        uint256 aliceShares = market.placeBet(true, 50e18);

        vm.prank(bob);
        market.placeBet(false, 50e18);

        // Resolve YES
        vm.warp(resolution);
        vm.prank(oracleAddr);
        market.proposeResolution(true);
        vm.warp(block.timestamp + 2 hours);
        market.finalizeResolution();

        // Alice claims
        uint256 balBefore = token.balanceOf(alice);
        vm.prank(alice);
        market.claimWinnings();
        uint256 balAfter = token.balanceOf(alice);

        assertEq(balAfter - balBefore, aliceShares);
    }

    function test_loserCannotClaim() public {
        vm.prank(alice);
        market.placeBet(true, 50e18);

        vm.warp(resolution);
        vm.prank(oracleAddr);
        market.proposeResolution(false);
        vm.warp(block.timestamp + 2 hours);
        market.finalizeResolution();

        vm.prank(alice);
        vm.expectRevert("Did not win");
        market.claimWinnings();
    }

    function test_cannotDoubleClaim() public {
        vm.prank(alice);
        market.placeBet(true, 50e18);

        vm.warp(resolution);
        vm.prank(oracleAddr);
        market.proposeResolution(true);
        vm.warp(block.timestamp + 2 hours);
        market.finalizeResolution();

        vm.prank(alice);
        market.claimWinnings();

        vm.prank(alice);
        vm.expectRevert("Already claimed");
        market.claimWinnings();
    }

    function test_cannotClaimBeforeResolved() public {
        vm.prank(alice);
        market.placeBet(true, 50e18);

        vm.prank(alice);
        vm.expectRevert("Market not resolved");
        market.claimWinnings();
    }
}
