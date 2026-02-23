import { prisma } from "../../shared/database/prisma";

export async function getUserBets(address: string) {
  const user = await prisma.user.findUnique({
    where: { address },
    select: { id: true },
  });

  if (!user) return [];

  return prisma.bet.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      outcome: true,
      shares: true,
      costBasis: true,
      claimed: true,
      createdAt: true,
      market: {
        select: {
          id: true,
          question: true,
          contractAddress: true,
          status: true,
          resolvedOutcome: true,
          qYes: true,
          qNo: true,
          b: true,
        },
      },
    },
  });
}
