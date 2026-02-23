import { app } from "./server";
import { heart } from "./orchestrator/heart";
import { marketCreator } from "./orchestrator/markets/creator";
import { marketMonitor } from "./orchestrator/markets/monitor";
import { dataServiceClient } from "./orchestrator/dataServiceClient";
import { checkConnection } from "./shared/blockchain/client";
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

  // Health check blockchain
  if (config.oraclePrivateKey && config.rpcUrl) {
    await checkConnection();
  } else {
    console.warn("⚠️  Blockchain not configured (missing ORACLE_PRIVATE_KEY or RPC_URL)");
  }

  // Start Express server
  app.listen(config.port, () => {
    console.log(`✓ Server listening on port ${config.port}`);
  });

  // Start orchestrator
  heart.register("marketCreator", marketCreator);
  heart.register("marketMonitor", marketMonitor);
  heart.start(config.tickIntervalMs);
  console.log("✓ Orchestrator started");
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
