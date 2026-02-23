import { getMarketContract } from "../../shared/blockchain/contracts";
import { prisma } from "../../shared/database/prisma";

export const marketExecutor = {
  async proposeResolution(
    marketId: string,
    contractAddress: string,
    outcome: boolean
  ) {
    const contract = getMarketContract(contractAddress);
    const tx = await contract.proposeResolution(outcome);
    await tx.wait();

    await prisma.market.update({
      where: { id: marketId },
      data: {
        status: "proposed",
        resolvedOutcome: outcome,
        proposedAt: new Date(),
      },
    });

    console.log(
      `[Executor] Proposed ${outcome ? "YES" : "NO"} for market ${marketId}`
    );
  },

  async canFinalize(contractAddress: string): Promise<boolean> {
    const contract = getMarketContract(contractAddress);
    const proposedTs = await contract.proposedTimestamp();
    const disputeWindow = await contract.DISPUTE_WINDOW();
    return Date.now() / 1000 >= Number(proposedTs) + Number(disputeWindow);
  },

  async finalizeResolution(marketId: string, contractAddress: string) {
    const contract = getMarketContract(contractAddress);
    const tx = await contract.finalizeResolution();
    await tx.wait();

    await prisma.market.update({
      where: { id: marketId },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
      },
    });

    console.log(`[Executor] Finalized resolution for market ${marketId}`);
  },
};
