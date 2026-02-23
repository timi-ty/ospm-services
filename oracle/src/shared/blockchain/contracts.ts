import { ethers } from "ethers";
import { oracleWallet } from "./client";
import { config } from "../config/env";

const MARKET_FACTORY_ABI = [
  "function createMarket(string _question, string _sourceUrl, uint256 _bettingCloseTimestamp, uint256 _resolutionTimestamp, uint256 _liquidityParameter) external returns (address)",
  "function getMarkets() external view returns (address[])",
  "function getMarketCount() external view returns (uint256)",
  "event MarketCreated(address indexed market, string question, uint256 bettingCloseTimestamp, uint256 resolutionTimestamp, uint256 liquidityParameter)",
];

const BINARY_MARKET_ABI = [
  "function question() view returns (string)",
  "function sourceUrl() view returns (string)",
  "function status() view returns (uint8)",
  "function getOdds() view returns (uint256 pYes, uint256 pNo)",
  "function qYes() view returns (int256)",
  "function qNo() view returns (int256)",
  "function b() view returns (uint256)",
  "function bettingCloseTimestamp() view returns (uint256)",
  "function resolutionTimestamp() view returns (uint256)",
  "function resolvedOutcome() view returns (bool)",
  "function proposedTimestamp() view returns (uint256)",
  "function DISPUTE_WINDOW() view returns (uint256)",
  "function bets(address) view returns (uint256 shares, bool outcome, uint256 costBasis, bool claimed)",
  "function proposeResolution(bool _outcome) external",
  "function finalizeResolution() external",
  "event ResolutionProposed(bool outcome, uint256 timestamp)",
  "event MarketResolved(bool outcome)",
];

export const marketFactory = new ethers.Contract(
  config.marketFactoryAddress,
  MARKET_FACTORY_ABI,
  oracleWallet
);

export function getMarketContract(address: string) {
  return new ethers.Contract(address, BINARY_MARKET_ABI, oracleWallet);
}

export async function deployMarket(
  question: string,
  sourceUrl: string,
  bettingCloseTimestamp: number,
  resolutionTimestamp: number
): Promise<string> {
  const tx = await marketFactory.createMarket(
    question,
    sourceUrl,
    bettingCloseTimestamp,
    resolutionTimestamp,
    0 // use factory default liquidity
  );
  const receipt = await tx.wait();

  // Parse MarketCreated event to get the deployed address
  for (const log of receipt.logs) {
    try {
      const parsed = marketFactory.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed?.name === "MarketCreated") {
        return parsed.args[0]; // market address
      }
    } catch {
      // Not our event, skip
    }
  }

  throw new Error("MarketCreated event not found in receipt");
}
