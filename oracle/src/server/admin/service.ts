import { prisma } from "../../shared/database/prisma";
import { heart } from "../../orchestrator/heart";
import { dataServiceClient } from "../../orchestrator/dataServiceClient";
import { provider, getOracleWallet } from "../../shared/blockchain/client";
import { getMarketFactory, getPlayTokenContract } from "../../shared/blockchain/contracts";
import { deployMarket } from "../../shared/blockchain/contracts";
import { config } from "../../shared/config/env";
import { ethers } from "ethers";
import sanitizeHtml from "sanitize-html";
import { sendEmail } from "../../shared/email/service";

const oracleStartedAt = new Date();

// ── Stats Overview ───────────────────────────────────────────────────────

export async function getStats() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    total,
    statusCounts,
    categoryCounts,
    deployedCount,
    createdLast24h,
    resolvedLast24h,
    totalBets,
    betsLast24h,
  ] = await Promise.all([
    prisma.market.count(),
    prisma.market.groupBy({ by: ["status"], _count: true }),
    prisma.market.groupBy({ by: ["category"], _count: true }),
    prisma.market.count({ where: { contractAddress: { not: null } } }),
    prisma.market.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.market.count({ where: { resolvedAt: { gte: oneDayAgo } } }),
    prisma.bet.count(),
    prisma.bet.count({ where: { createdAt: { gte: oneDayAgo } } }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const s of statusCounts) byStatus[s.status] = s._count;

  const byCategory: Record<string, number> = {};
  for (const c of categoryCounts) byCategory[c.category] = c._count;

  // System health
  const heartStats = heart.getStats();
  let dataServiceHealthy = false;
  try {
    dataServiceHealthy = await dataServiceClient.healthCheck();
  } catch {}

  let blockchainConnected = false;
  let oracleWalletBalance = "0";
  try {
    if (config.oraclePrivateKey) {
      const bal = await provider.getBalance(getOracleWallet().address);
      oracleWalletBalance = ethers.formatEther(bal);
      blockchainConnected = true;
    }
  } catch {}

  return {
    markets: {
      total,
      byStatus,
      byCategory,
      deployedOnChain: deployedCount,
      createdLast24h,
      resolvedLast24h,
    },
    bets: { total: totalBets, last24h: betsLast24h },
    system: {
      oracleUpSince: oracleStartedAt.toISOString(),
      tickCount: heartStats.tickCount,
      lastTickAt: heartStats.lastTickAt?.toISOString() ?? null,
      dataServiceHealthy,
      blockchainConnected,
      oracleWalletBalance,
    },
  };
}

// ── Time-Series ──────────────────────────────────────────────────────────

export async function getTimeseries(days: number) {
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const markets = await prisma.market.findMany({
    where: { createdAt: { gte: since } },
    select: {
      createdAt: true,
      deployedAt: true,
      proposedAt: true,
      resolvedAt: true,
    },
  });

  const buckets: Record<
    string,
    { created: number; deployed: number; proposed: number; resolved: number }
  > = {};

  // Initialize all days
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split("T")[0];
    buckets[key] = { created: 0, deployed: 0, proposed: 0, resolved: 0 };
  }

  for (const m of markets) {
    const cKey = m.createdAt.toISOString().split("T")[0];
    if (buckets[cKey]) buckets[cKey].created++;
    if (m.deployedAt) {
      const dKey = m.deployedAt.toISOString().split("T")[0];
      if (buckets[dKey]) buckets[dKey].deployed++;
    }
    if (m.proposedAt) {
      const pKey = m.proposedAt.toISOString().split("T")[0];
      if (buckets[pKey]) buckets[pKey].proposed++;
    }
    if (m.resolvedAt) {
      const rKey = m.resolvedAt.toISOString().split("T")[0];
      if (buckets[rKey]) buckets[rKey].resolved++;
    }
  }

  return {
    days: Object.entries(buckets)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// ── Advanced Market Query ────────────────────────────────────────────────

interface AdminMarketsParams {
  status?: string;
  category?: string;
  search?: string;
  expiresWithin?: number; // minutes
  resolvesWithin?: number; // minutes
  deployedOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  offset: number;
}

export async function getAdminMarkets(params: AdminMarketsParams) {
  const {
    status,
    category,
    search,
    expiresWithin,
    resolvesWithin,
    deployedOnly,
    dateFrom,
    dateTo,
    limit,
    offset,
  } = params;

  const where: any = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (search) where.question = { contains: search, mode: "insensitive" };
  if (deployedOnly) where.contractAddress = { not: null };

  if (expiresWithin) {
    const cutoff = new Date(Date.now() + expiresWithin * 60 * 1000);
    where.bettingClosesAt = { gte: new Date(), lte: cutoff };
    where.status = { in: ["open"] };
  }

  if (resolvesWithin) {
    const cutoff = new Date(Date.now() + resolvesWithin * 60 * 1000);
    where.resolvesAt = { gte: new Date(), lte: cutoff };
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const [markets, total] = await Promise.all([
    prisma.market.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.market.count({ where }),
  ]);

  return { markets, total, hasMore: offset + markets.length < total };
}

// ── Manual Actions ───────────────────────────────────────────────────────

export async function manualResolve(marketId: string, outcome: boolean) {
  const market = await prisma.market.findUnique({ where: { id: marketId } });
  if (!market) throw new Error("Market not found");
  if (!market.contractAddress) throw new Error("Market not deployed on-chain");

  // Import executor dynamically to avoid circular deps
  const { marketExecutor } = await import(
    "../../orchestrator/markets/executor"
  );

  await marketExecutor.proposeResolution(
    market.id,
    market.contractAddress,
    outcome
  );
  return { success: true, status: "proposed", outcome };
}

export async function triggerGeneration() {
  const healthy = await dataServiceClient.healthCheck();
  if (!healthy) throw new Error("Data Service is not healthy");

  const sources = await dataServiceClient.getSources();
  const sourceIds = sources.map((s: { id: string }) => s.id);
  const { job_id } = await dataServiceClient.triggerGeneration(sourceIds);
  return { success: true, job_id, sources: sourceIds };
}

export async function triggerDeployment() {
  const pending = await prisma.market.findMany({
    where: { status: "pending", contractAddress: null },
  });

  if (pending.length === 0) return { success: true, deployed: 0 };

  let deployed = 0;
  for (const market of pending) {
    try {
      const closeTs = Math.floor(market.bettingClosesAt.getTime() / 1000);
      const resolveTs = Math.floor(market.resolvesAt.getTime() / 1000);
      if (closeTs <= Math.floor(Date.now() / 1000)) continue;

      const contractAddress = await deployMarket(
        market.question,
        market.sourceUrl,
        closeTs,
        resolveTs
      );

      await prisma.market.update({
        where: { id: market.id },
        data: { contractAddress, status: "open", deployedAt: new Date() },
      });
      deployed++;
    } catch (error) {
      console.error(`[Admin] Deploy failed for ${market.id}:`, error);
    }
  }

  return { success: true, deployed, total: pending.length };
}

// ── System Info ──────────────────────────────────────────────────────────

export async function getSystemInfo() {
  const heartStats = heart.getStats();

  let dataServiceHealthy = false;
  try {
    dataServiceHealthy = await dataServiceClient.healthCheck();
  } catch {}

  let blockchain: any = { connected: false };
  try {
    if (config.oraclePrivateKey) {
      const wallet = getOracleWallet();
      const bal = await provider.getBalance(wallet.address);
      const network = await provider.getNetwork();
      let factoryMarketCount = 0;
      try {
        factoryMarketCount = Number(await getMarketFactory().getMarketCount());
      } catch {}

      blockchain = {
        connected: true,
        chainId: Number(network.chainId),
        oracleAddress: wallet.address,
        oracleBalance: ethers.formatEther(bal),
        marketFactoryAddress: config.marketFactoryAddress,
        playTokenAddress: config.playTokenAddress,
        factoryMarketCount,
      };
    }
  } catch {}

  return {
    oracle: {
      upSince: oracleStartedAt.toISOString(),
      port: config.port,
      nodeEnv: config.nodeEnv,
    },
    orchestrator: {
      tickCount: heartStats.tickCount,
      startedAt: heartStats.startedAt?.toISOString() ?? null,
      lastTickAt: heartStats.lastTickAt?.toISOString() ?? null,
      intervalMs: config.tickIntervalMs,
      handlers: heartStats.handlers,
    },
    dataService: {
      url: config.dataServiceUrl,
      healthy: dataServiceHealthy,
    },
    blockchain,
  };
}

// ── Market-Making Stats ─────────────────────────────────────────────────

export async function getMarketMakingStats() {
  const markets = await prisma.market.findMany({
    where: {
      contractAddress: { not: null },
      status: { in: ["open", "closed"] },
    },
    select: {
      id: true,
      question: true,
      bets: {
        select: { outcome: true, shares: true, costBasis: true },
      },
    },
  });

  let aggCollected = 0;
  let aggMaxPayout = 0;
  let aggExposure = 0;
  let marketsWithBets = 0;

  const perMarket = markets
    .filter((m) => m.bets.length > 0)
    .map((m) => {
      let totalCollected = 0;
      let totalYesShares = 0;
      let totalNoShares = 0;

      for (const bet of m.bets) {
        totalCollected += bet.costBasis;
        if (bet.outcome) totalYesShares += bet.shares;
        else totalNoShares += bet.shares;
      }

      const maxPayout = Math.max(totalYesShares, totalNoShares);
      const exposure = maxPayout - totalCollected;

      aggCollected += totalCollected;
      aggMaxPayout += maxPayout;
      aggExposure += exposure;
      marketsWithBets++;

      return {
        id: m.id,
        question: m.question,
        totalCollected: +totalCollected.toFixed(2),
        totalYesShares: +totalYesShares.toFixed(2),
        totalNoShares: +totalNoShares.toFixed(2),
        maxPayout: +maxPayout.toFixed(2),
        exposure: +exposure.toFixed(2),
      };
    });

  let oracleEthBalance = "0";
  let oraclePlayBalance = "0";
  try {
    const wallet = getOracleWallet();
    const ethBal = await provider.getBalance(wallet.address);
    oracleEthBalance = ethers.formatEther(ethBal);

    if (config.playTokenAddress) {
      const playToken = getPlayTokenContract();
      const playBal = await playToken.balanceOf(wallet.address);
      oraclePlayBalance = ethers.formatEther(playBal);
    }
  } catch {}

  return {
    oracleEthBalance,
    oraclePlayBalance,
    marketCount: marketsWithBets,
    totalCollected: +aggCollected.toFixed(2),
    maxPotentialPayout: +aggMaxPayout.toFixed(2),
    totalExposure: +aggExposure.toFixed(2),
    markets: perMarket,
  };
}

// ── Email Broadcast ─────────────────────────────────────────────────────

interface BroadcastState {
  status: "idle" | "sending" | "done";
  total: number;
  sent: number;
  failed: number;
  startedAt: string | null;
  finishedAt: string | null;
}

let broadcastState: BroadcastState = {
  status: "idle",
  total: 0,
  sent: 0,
  failed: 0,
  startedAt: null,
  finishedAt: null,
};

export function getBroadcastStatus() {
  return { ...broadcastState };
}

export async function getEmailableUserCount(): Promise<number> {
  return prisma.user.count({ where: { email: { not: null } } });
}

export async function broadcastEmail(subject: string, rawHtml: string) {
  if (broadcastState.status === "sending") {
    throw new Error("A broadcast is already in progress");
  }

  const cleanHtml = sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img", "style", "h1", "h2",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["style", "class"],
      img: ["src", "alt", "width", "height", "style"],
      a: ["href", "target", "rel", "style"],
    },
  });

  const users = await prisma.user.findMany({
    where: { email: { not: null } },
    select: { email: true },
  });

  broadcastState = {
    status: "sending",
    total: users.length,
    sent: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };

  (async () => {
    for (const user of users) {
      try {
        await sendEmail(user.email!, subject, cleanHtml);
        broadcastState.sent++;
      } catch {
        broadcastState.failed++;
      }
      // Small delay to avoid SMTP rate limits
      await new Promise((r) => setTimeout(r, 200));
    }
    broadcastState.status = "done";
    broadcastState.finishedAt = new Date().toISOString();
    console.log(
      `[Broadcast] Finished: ${broadcastState.sent} sent, ${broadcastState.failed} failed out of ${broadcastState.total}`
    );
  })();

  return { total: users.length };
}
