import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL!,
  dataServiceUrl: process.env.DATA_SERVICE_URL || "http://localhost:8000",
  tickIntervalMs: Number(process.env.TICK_INTERVAL_MS) || 60_000,
  marketCreationIntervalMs:
    Number(process.env.MARKET_CREATION_INTERVAL_MS) || 24 * 60 * 60 * 1000,
  frontendUrl: process.env.FRONTEND_URL || "*",
} as const;
