import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "../shared/config/env";
import { marketsRouter } from "./markets/routes";
import { adminRouter } from "./admin/routes";
import { authRouter } from "./auth/routes";
import { usersRouter } from "./users/routes";
import { leaderboardRouter } from "./leaderboard/routes";

const app = express();

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

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

export { app };
