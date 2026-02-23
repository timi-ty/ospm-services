import { prisma } from "../../shared/database/prisma";

interface LeaderboardEntry {
  address: string;
  wins: number;
  totalProfit: string;
  totalBets: number;
}

export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const users = await prisma.user.findMany({
    where: {
      bets: { some: {} },
    },
    select: {
      address: true,
      bets: {
        select: {
          outcome: true,
          shares: true,
          costBasis: true,
          market: {
            select: {
              status: true,
              resolvedOutcome: true,
            },
          },
        },
      },
    },
  });

  const entries: LeaderboardEntry[] = users.map((user) => {
    let wins = 0;
    let totalProfit = 0;

    for (const bet of user.bets) {
      if (bet.market.status === "resolved" && bet.market.resolvedOutcome !== null) {
        const won = bet.outcome === bet.market.resolvedOutcome;
        if (won) {
          wins++;
          totalProfit += bet.shares - bet.costBasis;
        } else {
          totalProfit -= bet.costBasis;
        }
      }
    }

    return {
      address: user.address,
      wins,
      totalProfit: totalProfit.toFixed(1),
      totalBets: user.bets.length,
    };
  });

  return entries
    .sort((a, b) => b.wins - a.wins || parseFloat(b.totalProfit) - parseFloat(a.totalProfit))
    .slice(0, limit);
}
