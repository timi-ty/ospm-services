import type { TickContext, TickHandler } from "./types";

class Heart {
  private intervalId: NodeJS.Timeout | null = null;
  private handlers: Map<string, TickHandler> = new Map();
  private tickCount = 0;

  register(name: string, handler: TickHandler) {
    this.handlers.set(name, handler);
    console.log(`[Heart] Registered: ${name}`);
  }

  start(intervalMs: number = 60_000) {
    if (this.intervalId) {
      console.warn("[Heart] Already running");
      return;
    }

    console.log(`[Heart] Starting with ${intervalMs}ms interval`);

    // Run immediately
    this.runTick();

    // Then on interval
    this.intervalId = setInterval(() => this.runTick(), intervalMs);
  }

  private async runTick() {
    this.tickCount++;
    const context: TickContext = {
      tickCount: this.tickCount,
      tickTime: new Date(),
      intervalMs: 60_000,
    };

    for (const [name, handler] of this.handlers) {
      try {
        await handler.tick(context);
      } catch (error) {
        console.error(`[Heart] "${name}" failed:`, error);
      }
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[Heart] Stopped");
    }
  }
}

export const heart = new Heart();
