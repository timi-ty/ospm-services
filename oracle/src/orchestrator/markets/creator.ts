import { shouldTick, type TickContext, type TickHandler } from "../types";
import { dataServiceClient } from "../dataServiceClient";
import { deployMarket } from "../../shared/blockchain/contracts";
import { prisma } from "../../shared/database/prisma";
import { config } from "../../shared/config/env";

class MarketCreator implements TickHandler {
  private lastGenerationAt: Date | null = null;

  async tick(context: TickContext): Promise<void> {
    // Deploy pending markets on every tick (~60s)
    await this.deployPendingMarkets();

    // Trigger AI generation on 24h cadence
    if (
      shouldTick(
        this.lastGenerationAt,
        config.marketCreationIntervalMs,
        context.tickTime
      )
    ) {
      await this.triggerGeneration();
      this.lastGenerationAt = context.tickTime;
    }
  }

  private async deployPendingMarkets() {
    if (!config.oraclePrivateKey || !config.marketFactoryAddress) return;

    const pending = await prisma.market.findMany({
      where: { status: "pending", contractAddress: null },
    });

    if (pending.length === 0) return;
    console.log(
      `[MarketCreator] Deploying ${pending.length} pending market(s) on-chain`
    );

    for (const market of pending) {
      try {
        const closeTs = Math.floor(market.bettingClosesAt.getTime() / 1000);
        const resolveTs = Math.floor(market.resolvesAt.getTime() / 1000);

        // Skip if timestamps are already in the past
        const now = Math.floor(Date.now() / 1000);
        if (closeTs <= now) {
          console.warn(
            `[MarketCreator] Skipping "${market.question}" — betting close already passed`
          );
          await prisma.market.update({
            where: { id: market.id },
            data: { status: "expired" },
          });
          continue;
        }

        const contractAddress = await deployMarket(
          market.question,
          market.sourceUrl,
          closeTs,
          resolveTs
        );

        await prisma.market.update({
          where: { id: market.id },
          data: {
            contractAddress,
            status: "open",
            deployedAt: new Date(),
          },
        });

        console.log(
          `[MarketCreator] Deployed "${market.question}" → ${contractAddress}`
        );
      } catch (error) {
        console.error(
          `[MarketCreator] Failed to deploy "${market.question}":`,
          error
        );
      }
    }
  }

  private async triggerGeneration() {
    try {
      const healthy = await dataServiceClient.healthCheck();
      if (!healthy) {
        console.warn("[MarketCreator] Data Service unhealthy, skipping generation");
        return;
      }

      const sources = await dataServiceClient.getSources();
      const sourceIds = sources.map((s: { id: string }) => s.id);
      console.log(
        `[MarketCreator] Triggering generation for: ${sourceIds.join(", ")}`
      );

      const { job_id } = await dataServiceClient.triggerGeneration(sourceIds);
      console.log(`[MarketCreator] Generation job: ${job_id}`);
    } catch (error) {
      console.error("[MarketCreator] Generation failed:", error);
    }
  }
}

export const marketCreator = new MarketCreator();
