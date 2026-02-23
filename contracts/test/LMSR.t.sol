// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LMSR} from "../src/LMSR.sol";

/// @dev Thin wrapper to expose library functions for testing.
contract LMSRHarness {
    function cost(int256 qYes, int256 qNo, uint256 b) external pure returns (uint256) {
        return LMSR.cost(qYes, qNo, b);
    }

    function prices(int256 qYes, int256 qNo, uint256 b) external pure returns (uint256 pYes, uint256 pNo) {
        return LMSR.prices(qYes, qNo, b);
    }

    function costForShares(bool outcome, int256 qYes, int256 qNo, uint256 b, uint256 shares)
        external
        pure
        returns (uint256)
    {
        return LMSR.costForShares(outcome, qYes, qNo, b, shares);
    }

    function sharesForCost(bool outcome, int256 qYes, int256 qNo, uint256 b, uint256 maxCost)
        external
        pure
        returns (uint256)
    {
        return LMSR.sharesForCost(outcome, qYes, qNo, b, maxCost);
    }
}

contract LMSRTest is Test {
    LMSRHarness lmsr;
    uint256 constant B = 100e18;

    function setUp() public {
        lmsr = new LMSRHarness();
    }

    // ── Cost function ────────────────────────────────────────────────────

    function test_costAtZero() public view {
        // C(0,0,b) = b * ln(2) ≈ 69.31e18
        uint256 c = lmsr.cost(0, 0, B);
        assertApproxEqRel(c, 69.314e18, 0.01e18); // 1% tolerance
    }

    function test_costIncreasesWithShares() public view {
        uint256 c0 = lmsr.cost(0, 0, B);
        uint256 c1 = lmsr.cost(10e18, 0, B);
        uint256 c2 = lmsr.cost(50e18, 0, B);
        assertTrue(c1 > c0);
        assertTrue(c2 > c1);
    }

    function test_costSymmetric() public view {
        uint256 cA = lmsr.cost(30e18, 10e18, B);
        uint256 cB = lmsr.cost(10e18, 30e18, B);
        assertEq(cA, cB);
    }

    // ── Prices ───────────────────────────────────────────────────────────

    function test_pricesEqualAtZero() public view {
        (uint256 pYes, uint256 pNo) = lmsr.prices(0, 0, B);
        assertApproxEqRel(pYes, 0.5e18, 0.001e18);
        assertApproxEqRel(pNo, 0.5e18, 0.001e18);
    }

    function test_pricesSumToOne() public view {
        (uint256 pYes, uint256 pNo) = lmsr.prices(30e18, 10e18, B);
        assertApproxEqAbs(pYes + pNo, 1e18, 1e12); // within 1e-6
    }

    function test_pricesShiftWithShares() public view {
        (uint256 pYes0,) = lmsr.prices(0, 0, B);
        (uint256 pYes1,) = lmsr.prices(50e18, 0, B);
        assertTrue(pYes1 > pYes0);
    }

    function test_pricesExtremeYes() public view {
        (uint256 pYes,) = lmsr.prices(500e18, 0, B);
        assertTrue(pYes > 0.99e18);
    }

    // ── Cost for shares ──────────────────────────────────────────────────

    function test_costForSharesPositive() public view {
        uint256 c = lmsr.costForShares(true, 0, 0, B, 10e18);
        assertTrue(c > 0);
    }

    function test_costForSharesIncreasing() public view {
        uint256 c1 = lmsr.costForShares(true, 0, 0, B, 10e18);
        uint256 c2 = lmsr.costForShares(true, 0, 0, B, 50e18);
        assertTrue(c2 > c1);
    }

    function test_costForSharesAtFiftyFifty() public view {
        // At 50/50, marginal price of YES ≈ 0.5 per share.
        // 10 shares should cost roughly 5 tokens.
        uint256 c = lmsr.costForShares(true, 0, 0, B, 10e18);
        assertApproxEqRel(c, 5.012e18, 0.05e18); // 5% tolerance
    }

    // ── Shares for cost (binary search) ──────────────────────────────────

    function test_sharesForCostConverges() public view {
        uint256 budget = 50e18;
        uint256 shares = lmsr.sharesForCost(true, 0, 0, B, budget);
        assertTrue(shares > 0);

        // Verify the cost is within budget
        uint256 actualCost = lmsr.costForShares(true, 0, 0, B, shares);
        assertTrue(actualCost <= budget);

        // And one more share would exceed budget
        uint256 costPlus = lmsr.costForShares(true, 0, 0, B, shares + 1);
        assertTrue(costPlus > budget || costPlus == actualCost);
    }

    function test_sharesForCostZero() public view {
        assertEq(lmsr.sharesForCost(true, 0, 0, B, 0), 0);
    }

    function test_sharesForCostLargeBudget() public view {
        uint256 shares = lmsr.sharesForCost(true, 0, 0, B, 500e18);
        assertTrue(shares > 0);
        uint256 actualCost = lmsr.costForShares(true, 0, 0, B, shares);
        assertTrue(actualCost <= 500e18);
    }
}
