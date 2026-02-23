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

  // Auth (Privy)
  privyAppId: process.env.PRIVY_APP_ID || "",
  privyAppSecret: process.env.PRIVY_APP_SECRET || "",

  // Blockchain
  rpcUrl: process.env.RPC_URL || "https://sepolia.base.org",
  oraclePrivateKey: process.env.ORACLE_PRIVATE_KEY || "",
  marketFactoryAddress: process.env.MARKET_FACTORY_ADDRESS || "",
  playTokenAddress: process.env.PLAY_TOKEN_ADDRESS || "",

  // Notifications (optional)
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
} as const;
