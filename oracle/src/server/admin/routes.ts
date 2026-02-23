import { Router } from "express";
import {
  getStats,
  getTimeseries,
  getAdminMarkets,
  manualResolve,
  triggerGeneration,
  triggerDeployment,
  getSystemInfo,
} from "./service";

const router = Router();

// ── Stats ────────────────────────────────────────────────────────────────

router.get("/stats", async (_req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    console.error("GET /admin/stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/stats/timeseries", async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days as string, 10) || 7, 90);
    const data = await getTimeseries(days);
    res.json(data);
  } catch (error) {
    console.error("GET /admin/stats/timeseries error:", error);
    res.status(500).json({ error: "Failed to fetch timeseries" });
  }
});

// ── Markets ──────────────────────────────────────────────────────────────

router.get("/markets", async (req, res) => {
  try {
    const {
      status,
      category,
      search,
      expiresWithin,
      resolvesWithin,
      deployedOnly,
      dateFrom,
      dateTo,
      limit = "20",
      offset = "0",
    } = req.query;

    const result = await getAdminMarkets({
      status: status as string | undefined,
      category: category as string | undefined,
      search: search as string | undefined,
      expiresWithin: expiresWithin ? parseInt(expiresWithin as string, 10) : undefined,
      resolvesWithin: resolvesWithin ? parseInt(resolvesWithin as string, 10) : undefined,
      deployedOnly: deployedOnly === "true",
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      limit: Math.min(parseInt(limit as string, 10) || 20, 100),
      offset: parseInt(offset as string, 10) || 0,
    });

    res.json(result);
  } catch (error) {
    console.error("GET /admin/markets error:", error);
    res.status(500).json({ error: "Failed to fetch markets" });
  }
});

// ── Manual Actions ───────────────────────────────────────────────────────

router.post("/markets/:id/resolve", async (req, res) => {
  try {
    const { outcome } = req.body;
    if (typeof outcome !== "boolean") {
      return res.status(400).json({ error: "outcome (boolean) required" });
    }
    const result = await manualResolve(req.params.id, outcome);
    res.json(result);
  } catch (error: any) {
    console.error("POST /admin/markets/:id/resolve error:", error);
    res.status(400).json({ error: error.message || "Failed to resolve" });
  }
});

router.post("/trigger-generation", async (_req, res) => {
  try {
    const result = await triggerGeneration();
    res.json(result);
  } catch (error: any) {
    console.error("POST /admin/trigger-generation error:", error);
    res.status(500).json({ error: error.message || "Failed to trigger" });
  }
});

router.post("/trigger-deployment", async (_req, res) => {
  try {
    const result = await triggerDeployment();
    res.json(result);
  } catch (error: any) {
    console.error("POST /admin/trigger-deployment error:", error);
    res.status(500).json({ error: error.message || "Failed to deploy" });
  }
});

// ── System ───────────────────────────────────────────────────────────────

router.get("/system", async (_req, res) => {
  try {
    const info = await getSystemInfo();
    res.json(info);
  } catch (error) {
    console.error("GET /admin/system error:", error);
    res.status(500).json({ error: "Failed to fetch system info" });
  }
});

export { router as adminRouter };
