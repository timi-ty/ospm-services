import type { TickContext, TickHandler } from "./types";
import { prisma } from "../shared/database/prisma";

class Heart {
  private intervalId: NodeJS.Timeout | null = null;
  private handlers: Map<string, TickHandler> = new Map();
  private tickCount = 0;
  private startedAt: Date | null = null;
  private lastTickAt: Date | null = null;
  private handlerLastRun: Map<string, Date | null> = new Map();

  register(name: string, handler: TickHandler) {
    this.handlers.set(name, handler);
    this.handlerLastRun.set(name, null);
    console.log(`[Heart] Registered: ${name}`);
  }

  start(intervalMs: number = 60_000) {
    if (this.intervalId) {
      console.warn("[Heart] Already running");
      return;
    }

    this.startedAt = new Date();
    console.log(`[Heart] Starting with ${intervalMs}ms interval`);

    this.runTick();
    this.intervalId = setInterval(() => this.runTick(), intervalMs);
  }

  private async runTick() {
    this.tickCount++;
    this.lastTickAt = new Date();

    const context: TickContext = {
      tickCount: this.tickCount,
      tickTime: this.lastTickAt,
      intervalMs: 60_000,
    };

    const handlerResults: Record<string, string> = {};
    let allHealthy = true;

    for (const [name, handler] of this.handlers) {
      try {
        await handler.tick(context);
        this.handlerLastRun.set(name, new Date());
        handlerResults[name] = "ok";
      } catch (error) {
        console.error(`[Heart] "${name}" failed:`, error);
        handlerResults[name] = "error";
        allHealthy = false;
      }
    }

    try {
      await prisma.healthLog.create({
        data: {
          tickCount: this.tickCount,
          status: allHealthy ? "healthy" : "degraded",
          details: JSON.stringify(handlerResults),
        },
      });
      // Keep only last 100 entries
      const cutoff = await prisma.healthLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: 100,
        take: 1,
        select: { createdAt: true },
      });
      if (cutoff.length > 0) {
        await prisma.healthLog.deleteMany({
          where: { createdAt: { lt: cutoff[0].createdAt } },
        });
      }
    } catch {
      // Non-critical: don't crash the tick loop
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[Heart] Stopped");
    }
  }

  getStats() {
    return {
      tickCount: this.tickCount,
      startedAt: this.startedAt,
      lastTickAt: this.lastTickAt,
      handlers: Array.from(this.handlers.keys()).map((name) => ({
        name,
        lastRunAt: this.handlerLastRun.get(name)?.toISOString() ?? null,
      })),
    };
  }
}

export const heart = new Heart();
