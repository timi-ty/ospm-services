import { shouldTick, type TickContext, type TickHandler } from "../types";
import { dataServiceClient } from "../dataServiceClient";
import { config } from "../../shared/config/env";

class MarketCreator implements TickHandler {
  private lastTickedAt: Date | null = null;
  private tickEveryMs: number;

  constructor() {
    this.tickEveryMs = config.marketCreationIntervalMs;
  }

  async tick(context: TickContext): Promise<void> {
    if (!shouldTick(this.lastTickedAt, this.tickEveryMs, context.tickTime)) {
      return;
    }

    console.log(`[MarketCreator] Running at tick #${context.tickCount}`);

    try {
      // Check Data Service health
      const healthy = await dataServiceClient.healthCheck();
      if (!healthy) {
        console.error("[MarketCreator] Data Service unhealthy, will retry next tick");
        return;
      }

      // Get all available sources
      const sources = await dataServiceClient.getSources();
      const sourceIds = sources.map((s: { id: string }) => s.id);
      console.log(`[MarketCreator] Triggering generation for sources: ${sourceIds.join(", ")}`);

      // Trigger async generation - returns immediately
      const { job_id } = await dataServiceClient.triggerGeneration(sourceIds);
      console.log(`[MarketCreator] Generation triggered, job_id: ${job_id}`);

      // Only mark as ticked after successful trigger
      this.lastTickedAt = context.tickTime;

      // Markets will arrive via POST /api/markets/ingest callback
    } catch (error) {
      console.error("[MarketCreator] Failed, will retry next tick:", error);
    }
  }
}

export const marketCreator = new MarketCreator();
