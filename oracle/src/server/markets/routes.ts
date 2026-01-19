import { Router } from "express";
import { getMarkets, getMarketById, ingestMarkets } from "./service";

const router = Router();

// GET /api/markets
router.get("/", async (req, res) => {
  try {
    const { status, category, limit = "20", offset = "0" } = req.query;

    const result = await getMarkets({
      status: status as string | undefined,
      category: category as string | undefined,
      limit: Math.min(parseInt(limit as string, 10) || 20, 100),
      offset: parseInt(offset as string, 10) || 0,
    });

    res.json(result);
  } catch (error) {
    console.error("GET /markets error:", error);
    res.status(500).json({ error: "Failed to fetch markets" });
  }
});

// GET /api/markets/:id
router.get("/:id", async (req, res) => {
  try {
    const market = await getMarketById(req.params.id);

    if (!market) {
      return res.status(404).json({ error: "Market not found" });
    }

    res.json({ market });
  } catch (error) {
    console.error("GET /markets/:id error:", error);
    res.status(500).json({ error: "Failed to fetch market" });
  }
});

// POST /api/markets/ingest - Callback from Data Service
router.post("/ingest", async (req, res) => {
  try {
    const { markets, errors, generated_at } = req.body;

    if (!markets || !Array.isArray(markets)) {
      return res.status(400).json({ error: "markets array required" });
    }

    console.log(
      `[Ingest] Received ${markets.length} markets, ${errors?.length || 0} errors at ${generated_at}`
    );

    const result = await ingestMarkets(markets);

    console.log(
      `[Ingest] Created: ${result.created}, Duplicates: ${result.duplicates}, Errors: ${result.errors}`
    );

    res.json({
      created: result.created,
      duplicates: result.duplicates,
      errors: result.errors,
      received: markets.length,
    });
  } catch (error) {
    console.error("POST /markets/ingest error:", error);
    res.status(500).json({ error: "Failed to ingest markets" });
  }
});

export { router as marketsRouter };
