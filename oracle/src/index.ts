import { app } from "./server";
import { heart } from "./orchestrator/heart";
import { marketCreator } from "./orchestrator/markets/creator";
import { dataServiceClient } from "./orchestrator/dataServiceClient";
import { config } from "./shared/config/env";

async function main() {
  console.log("Starting Oracle Service...");

  // Health check Data Service
  const dataServiceHealthy = await dataServiceClient.healthCheck();
  if (!dataServiceHealthy) {
    console.warn(`⚠️  Data Service not reachable at ${config.dataServiceUrl}`);
  } else {
    console.log("✓ Data Service healthy");
  }

  // Start Express server
  app.listen(config.port, () => {
    console.log(`✓ Server listening on port ${config.port}`);
  });

  // Start orchestrator
  heart.register("marketCreator", marketCreator);
  heart.start(config.tickIntervalMs);
  console.log("✓ Orchestrator started");

  // Dev mode: trigger immediate generation
  if (config.nodeEnv === "development") {
    console.log("Dev mode: triggering market generation in 5s...");
    setTimeout(() => {
      marketCreator.generateNow().catch(console.error);
    }, 5000);
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  heart.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down...");
  heart.stop();
  process.exit(0);
});

main().catch((error) => {
  console.error("Failed to start:", error);
  process.exit(1);
});
