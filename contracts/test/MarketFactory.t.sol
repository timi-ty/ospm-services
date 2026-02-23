// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PlayToken} from "../src/PlayToken.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {BinaryMarket} from "../src/BinaryMarket.sol";

contract MarketFactoryTest is Test {
    PlayToken token;
    MarketFactory factory;

    address oracleAddr = makeAddr("oracle");
    address alice = makeAddr("alice");

    function setUp() public {
        token = new PlayToken();
        factory = new MarketFactory(address(token), oracleAddr);

        // Owner approves factory to pull subsidy tokens
        token.approve(address(factory), type(uint256).max);
    }

    function _createDefaultMarket() internal returns (address) {
        return factory.createMarket(
            "Will it rain?",
            "https://weather.com",
            block.timestamp + 1 days,
            block.timestamp + 2 days,
            0 // use default liquidity
        );
    }

    // ── Creation ─────────────────────────────────────────────────────────

    function test_createMarket() public {
        address mkt = _createDefaultMarket();
        assertTrue(mkt != address(0));
        assertTrue(factory.isMarket(mkt));
    }

    function test_createMarketEmitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit MarketFactory.MarketCreated(
            address(0), // we don't know address yet
            "Will it rain?",
            block.timestamp + 1 days,
            block.timestamp + 2 days,
            100e18
        );
        _createDefaultMarket();
    }

    function test_marketReceivesSubsidy() public {
        address mkt = _createDefaultMarket();
        uint256 subsidy = factory.subsidyRequired(100e18);
        assertEq(token.balanceOf(mkt), subsidy);
    }

    function test_marketFieldsCorrect() public {
        address mkt = _createDefaultMarket();
        BinaryMarket m = BinaryMarket(mkt);

        assertEq(m.question(), "Will it rain?");
        assertEq(m.sourceUrl(), "https://weather.com");
        assertEq(m.b(), 100e18);
        assertEq(m.oracle(), oracleAddr);
        assertEq(uint256(m.status()), uint256(BinaryMarket.Status.OPEN));
    }

    function test_customLiquidity() public {
        address mkt = factory.createMarket(
            "Custom b?",
            "https://example.com",
            block.timestamp + 1 days,
            block.timestamp + 2 days,
            200e18
        );
        assertEq(BinaryMarket(mkt).b(), 200e18);
        assertEq(token.balanceOf(mkt), factory.subsidyRequired(200e18));
    }

    // ── Tracking ─────────────────────────────────────────────────────────

    function test_getMarkets() public {
        address m1 = _createDefaultMarket();
        address m2 = factory.createMarket(
            "Second?",
            "https://b.com",
            block.timestamp + 1 days,
            block.timestamp + 2 days,
            0
        );

        address[] memory all = factory.getMarkets();
        assertEq(all.length, 2);
        assertEq(all[0], m1);
        assertEq(all[1], m2);
    }

    function test_getMarketCount() public {
        assertEq(factory.getMarketCount(), 0);
        _createDefaultMarket();
        assertEq(factory.getMarketCount(), 1);
    }

    // ── Access control ───────────────────────────────────────────────────

    function test_onlyOwnerCreates() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.createMarket(
            "Nope",
            "https://x.com",
            block.timestamp + 1 days,
            block.timestamp + 2 days,
            0
        );
    }

    function test_setOracle() public {
        address newOracle = makeAddr("newOracle");
        factory.setOracle(newOracle);
        assertEq(factory.oracle(), newOracle);
    }

    function test_setOracle_revertNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.setOracle(alice);
    }

    function test_setOracle_revertZeroAddress() public {
        vm.expectRevert("Zero address");
        factory.setOracle(address(0));
    }

    function test_setDefaultLiquidity() public {
        factory.setDefaultLiquidity(200e18);
        assertEq(factory.defaultLiquidity(), 200e18);
    }

    function test_setDefaultLiquidity_revertZero() public {
        vm.expectRevert("Must be > 0");
        factory.setDefaultLiquidity(0);
    }

    // ── Subsidy ──────────────────────────────────────────────────────────

    function test_subsidyRequired() public view {
        assertEq(factory.subsidyRequired(100e18), 70e18);
        assertEq(factory.subsidyRequired(200e18), 140e18);
    }
}
