import { Router } from "express";
import { ethers } from "ethers";
import {
  getStats,
  getTimeseries,
  getAdminMarkets,
  manualResolve,
  triggerGeneration,
  triggerDeployment,
  getSystemInfo,
  getMarketMakingStats,
  broadcastEmail,
  getBroadcastStatus,
  getEmailableUserCount,
} from "./service";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { setOracleWallet } from "../../shared/blockchain/client";
import { updateEnvVar } from "../../shared/config/envWriter";
import { config } from "../../shared/config/env";

const router = Router();

router.use(adminAuthMiddleware);

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

// ── Market Making ───────────────────────────────────────────────────────

router.get("/market-making", async (_req, res) => {
  try {
    const stats = await getMarketMakingStats();
    res.json(stats);
  } catch (error) {
    console.error("GET /admin/market-making error:", error);
    res.status(500).json({ error: "Failed to fetch market-making stats" });
  }
});

// ── Wallet Configuration ────────────────────────────────────────────────

router.post("/wallet", async (req, res) => {
  try {
    const { privateKey, password } = req.body;

    if (!privateKey || !password) {
      return res.status(400).json({ error: "privateKey and password required" });
    }

    if (!config.adminPassword) {
      return res.status(500).json({ error: "ADMIN_PASSWORD not configured on server" });
    }

    if (password !== config.adminPassword) {
      return res.status(403).json({ error: "Invalid admin password" });
    }

    let address: string;
    try {
      const wallet = new ethers.Wallet(privateKey);
      address = wallet.address;
    } catch {
      return res.status(400).json({ error: "Invalid private key" });
    }

    setOracleWallet(privateKey);
    updateEnvVar("ORACLE_PRIVATE_KEY", privateKey);

    res.json({ success: true, address });
  } catch (error: any) {
    console.error("POST /admin/wallet error:", error);
    res.status(500).json({ error: error.message || "Failed to update wallet" });
  }
});

// ── Email Broadcast ─────────────────────────────────────────────────────

router.post("/email/broadcast", async (req, res) => {
  try {
    const { subject, html } = req.body;
    if (!subject || !html) {
      return res.status(400).json({ error: "subject and html required" });
    }
    const result = await broadcastEmail(subject, html);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("POST /admin/email/broadcast error:", error);
    res.status(400).json({ error: error.message || "Failed to start broadcast" });
  }
});

router.get("/email/status", async (_req, res) => {
  try {
    const status = getBroadcastStatus();
    res.json(status);
  } catch (error) {
    console.error("GET /admin/email/status error:", error);
    res.status(500).json({ error: "Failed to fetch broadcast status" });
  }
});

router.get("/email/user-count", async (_req, res) => {
  try {
    const count = await getEmailableUserCount();
    res.json({ count });
  } catch (error) {
    console.error("GET /admin/email/user-count error:", error);
    res.status(500).json({ error: "Failed to count users" });
  }
});

export { router as adminRouter };
