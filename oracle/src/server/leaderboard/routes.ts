import { Router } from "express";
import { getLeaderboard } from "./service";

const router = Router();

// GET /api/leaderboard — public
router.get("/", async (_req, res) => {
  try {
    const entries = await getLeaderboard();
    res.json(entries);
  } catch (error) {
    console.error("GET /leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

export { router as leaderboardRouter };
