import { ethers } from "ethers";
import { prisma } from "../../shared/database/prisma";
import { getMarketContract } from "../../shared/blockchain/contracts";

/**
 * Sync a user's on-chain bets to the database.
 * Reads the bet state from each deployed market contract and upserts to DB.
 */
export async function syncUserBetsFromChain(userId: string, address: string): Promise<void> {
  const deployedMarkets = await prisma.market.findMany({
    where: {
      contractAddress: { not: null },
      status: { notIn: ["pending", "expired"] },
    },
    select: { id: true, contractAddress: true },
  });

  if (deployedMarkets.length === 0) return;

  let synced = 0;
  for (const market of deployedMarkets) {
    try {
      const contract = getMarketContract(market.contractAddress!);
      const [shares, outcome, costBasis, claimed] = await contract.bets(address);

      const sharesNum = Number(ethers.formatEther(shares));
      if (sharesNum === 0) continue;

      const costNum = Number(ethers.formatEther(costBasis));

      // Upsert: find existing bet by (userId + marketId) or create
      const existing = await prisma.bet.findFirst({
        where: { userId, marketId: market.id },
      });

      if (existing) {
        // Update if chain state differs
        if (
          existing.shares !== sharesNum ||
          existing.costBasis !== costNum ||
          existing.claimed !== claimed
        ) {
          await prisma.bet.update({
            where: { id: existing.id },
            data: {
              shares: sharesNum,
              outcome,
              costBasis: costNum,
              claimed,
            },
          });
          synced++;
        }
      } else {
        await prisma.bet.create({
          data: {
            userId,
            marketId: market.id,
            outcome,
            shares: sharesNum,
            costBasis: costNum,
            claimed,
          },
        });
        synced++;
      }
    } catch {
      // Non-critical: skip this market, will retry next time
    }
  }

  if (synced > 0) {
    console.log(`[BetSync] Synced ${synced} bet(s) for ${address}`);
  }
}
