import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "../shared/config/env";
import { heart } from "../orchestrator/heart";
import { prisma } from "../shared/database/prisma";
import { marketsRouter } from "./markets/routes";
import { adminRouter } from "./admin/routes";
import { authRouter } from "./auth/routes";
import { usersRouter } from "./users/routes";
import { leaderboardRouter } from "./leaderboard/routes";
import { gasRouter } from "./gas/routes";

const app = express();

app.set("trust proxy", 1);

// Security
app.use(helmet());
app.use(
  cors({
    origin: [...config.frontendUrls, "http://localhost:3000"].filter(Boolean),
    credentials: true,
  })
);
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
});
app.use(limiter);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/markets", marketsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/users", usersRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/gas", gasRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/health/detailed", async (_req, res) => {
  try {
    const stats = heart.getStats();
    const recentHealth = await prisma.healthLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const lastTick = stats.lastTickAt;
    const uptimeSeconds = stats.startedAt
      ? Math.floor((Date.now() - stats.startedAt.getTime()) / 1000)
      : 0;

    const latestStatus = recentHealth[0]?.status || "unknown";

    res.json({
      status: latestStatus,
      uptimeSeconds,
      lastTickAt: lastTick?.toISOString() ?? null,
      tickCount: stats.tickCount,
      handlers: stats.handlers,
      recentHealth: recentHealth.map((h) => ({
        tickCount: h.tickCount,
        status: h.status,
        details: h.details ? JSON.parse(h.details) : null,
        createdAt: h.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    res.status(500).json({ status: "error", error: "Failed to fetch health" });
  }
});

export { app };
