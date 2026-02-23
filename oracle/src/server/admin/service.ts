import { prisma } from "../../shared/database/prisma";
import { heart } from "../../orchestrator/heart";
import { dataServiceClient } from "../../orchestrator/dataServiceClient";
import { provider, oracleWallet } from "../../shared/blockchain/client";
import { marketFactory } from "../../shared/blockchain/contracts";
import { deployMarket } from "../../shared/blockchain/contracts";
import { config } from "../../shared/config/env";
import { ethers } from "ethers";

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
      const bal = await provider.getBalance(oracleWallet.address);
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
      const bal = await provider.getBalance(oracleWallet.address);
      const network = await provider.getNetwork();
      let factoryMarketCount = 0;
      try {
        factoryMarketCount = Number(await marketFactory.getMarketCount());
      } catch {}

      blockchain = {
        connected: true,
        chainId: Number(network.chainId),
        oracleAddress: oracleWallet.address,
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
