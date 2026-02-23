// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {BinaryMarket} from "./BinaryMarket.sol";

contract MarketFactory is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable playToken;
    address public oracle;
    uint256 public defaultLiquidity = 100e18;

    address[] public markets;
    mapping(address => bool) public isMarket;

    event MarketCreated(
        address indexed market,
        string question,
        uint256 bettingCloseTimestamp,
        uint256 resolutionTimestamp,
        uint256 liquidityParameter
    );

    constructor(address _playToken, address _oracle) Ownable(msg.sender) {
        require(_playToken != address(0) && _oracle != address(0), "Zero address");
        playToken = IERC20(_playToken);
        oracle = _oracle;
    }

    /// @notice Liquidity subsidy per market ≈ b × ln(2), rounded up for safety.
    function subsidyRequired(uint256 _liquidity) public pure returns (uint256) {
        return (_liquidity * 7) / 10;
    }

    function createMarket(
        string calldata _question,
        string calldata _sourceUrl,
        uint256 _bettingCloseTimestamp,
        uint256 _resolutionTimestamp,
        uint256 _liquidityParameter
    ) external onlyOwner returns (address) {
        uint256 liquidity = _liquidityParameter > 0 ? _liquidityParameter : defaultLiquidity;

        BinaryMarket market = new BinaryMarket(
            address(playToken),
            oracle,
            _question,
            _sourceUrl,
            _bettingCloseTimestamp,
            _resolutionTimestamp,
            liquidity
        );

        address marketAddr = address(market);

        // Transfer liquidity subsidy from caller to fund the market maker
        uint256 subsidy = subsidyRequired(liquidity);
        playToken.safeTransferFrom(msg.sender, marketAddr, subsidy);

        markets.push(marketAddr);
        isMarket[marketAddr] = true;

        emit MarketCreated(
            marketAddr,
            _question,
            _bettingCloseTimestamp,
            _resolutionTimestamp,
            liquidity
        );

        return marketAddr;
    }

    function getMarkets() external view returns (address[] memory) {
        return markets;
    }

    function getMarketCount() external view returns (uint256) {
        return markets.length;
    }

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Zero address");
        oracle = _oracle;
    }

    function setDefaultLiquidity(uint256 _liquidity) external onlyOwner {
        require(_liquidity > 0, "Must be > 0");
        defaultLiquidity = _liquidity;
    }
}
