import { shouldTick, type TickContext, type TickHandler } from "../types";
import { dataServiceClient } from "../dataServiceClient";
import { marketExecutor } from "./executor";
import { getMarketContract } from "../../shared/blockchain/contracts";
import { prisma } from "../../shared/database/prisma";
import { ethers } from "ethers";

const LIFECYCLE_TICK_MS = 5 * 60 * 1000; // 5 minutes
const SYNC_TICK_MS = 30 * 60 * 1000; // 30 minutes

const ON_CHAIN_STATUS = ["open", "proposed", "resolved", "disputed"] as const;

class MarketMonitor implements TickHandler {
  private lastLifecycleAt: Date | null = null;
  private lastSyncAt: Date | null = null;

  async tick(context: TickContext): Promise<void> {
    // Lifecycle checks every 5 minutes
    if (shouldTick(this.lastLifecycleAt, LIFECYCLE_TICK_MS, context.tickTime)) {
      this.lastLifecycleAt = context.tickTime;
      console.log(`[MarketMonitor] Running lifecycle at tick #${context.tickCount}`);
      await this.closeBettingExpired();
      await this.resolveExpiredMarkets();
      await this.finalizeProposedMarkets();
      await this.syncLMSRCache();
    }

    // Full status sync every 30 minutes
    if (shouldTick(this.lastSyncAt, SYNC_TICK_MS, context.tickTime)) {
      this.lastSyncAt = context.tickTime;
      await this.syncOnChainStatus();
    }
  }

  // ── 6.2: Betting Close ───────────────────────────────────────────────

  private async closeBettingExpired() {
    const result = await prisma.market.updateMany({
      where: {
        status: "open",
        bettingClosesAt: { lte: new Date() },
      },
      data: { status: "closed" },
    });

    if (result.count > 0) {
      console.log(`[MarketMonitor] Closed betting on ${result.count} market(s)`);
    }
  }

  // ── 6.1: Resolution ──────────────────────────────────────────────────

  private async resolveExpiredMarkets() {
    const expired = await prisma.market.findMany({
      where: {
        status: { in: ["open", "closed"] },
        resolvesAt: { lte: new Date() },
        contractAddress: { not: null },
      },
    });

    if (expired.length === 0) return;
    console.log(
      `[MarketMonitor] ${expired.length} market(s) ready for resolution`
    );

    for (const market of expired) {
      try {
        const result = await dataServiceClient.verifyOutcome({
          source_url: market.sourceUrl,
          question: market.question,
          resolution_context: market.resolutionContext || "",
        });

        if (result.outcome !== null && result.confidence >= 0.5) {
          await marketExecutor.proposeResolution(
            market.id,
            market.contractAddress!,
            result.outcome
          );
          console.log(
            `[MarketMonitor] Proposed ${result.outcome ? "YES" : "NO"} for "${market.question}" (confidence: ${result.confidence})`
          );
        } else {
          await prisma.market.update({
            where: { id: market.id },
            data: { status: "pending_resolution" },
          });
          console.log(
            `[MarketMonitor] Uncertain outcome for "${market.question}" — flagged for review`
          );
        }
      } catch (error) {
        console.error(
          `[MarketMonitor] Failed to resolve "${market.question}":`,
          error
        );
      }
    }
  }

  // ── 6.1: Finalization ─────────────────────────────────────────────────

  private async finalizeProposedMarkets() {
    const proposed = await prisma.market.findMany({
      where: {
        status: "proposed",
        contractAddress: { not: null },
      },
    });

    for (const market of proposed) {
      try {
        const canFinalize = await marketExecutor.canFinalize(
          market.contractAddress!
        );
        if (canFinalize) {
          await marketExecutor.finalizeResolution(
            market.id,
            market.contractAddress!
          );
        }
      } catch (error) {
        console.error(
          `[MarketMonitor] Failed to finalize "${market.question}":`,
          error
        );
      }
    }
  }

  // ── 6.4: LMSR Cache Sync ─────────────────────────────────────────────

  private async syncLMSRCache() {
    const deployed = await prisma.market.findMany({
      where: {
        contractAddress: { not: null },
        status: { in: ["open", "closed"] },
      },
      select: { id: true, contractAddress: true, qYes: true, qNo: true },
    });

    if (deployed.length === 0) return;

    let synced = 0;
    for (const market of deployed) {
      try {
        const contract = getMarketContract(market.contractAddress!);
        const [chainQYes, chainQNo] = await Promise.all([
          contract.qYes(),
          contract.qNo(),
        ]);

        const qYes = Number(ethers.formatEther(chainQYes));
        const qNo = Number(ethers.formatEther(chainQNo));

        if (qYes !== market.qYes || qNo !== market.qNo) {
          await prisma.market.update({
            where: { id: market.id },
            data: { qYes, qNo },
          });
          synced++;
        }
      } catch (error) {
        // Non-critical: skip silently, will retry next tick
      }
    }

    if (synced > 0) {
      console.log(`[MarketMonitor] Synced LMSR state for ${synced} market(s)`);
    }
  }

  // ── 6.3: Status Sync ──────────────────────────────────────────────────

  private async syncOnChainStatus() {
    const deployed = await prisma.market.findMany({
      where: {
        contractAddress: { not: null },
        status: { notIn: ["resolved", "expired", "pending"] },
      },
      select: { id: true, contractAddress: true, status: true },
    });

    if (deployed.length === 0) return;

    let synced = 0;
    for (const market of deployed) {
      try {
        const contract = getMarketContract(market.contractAddress!);
        const chainStatusNum = Number(await contract.status());
        const chainStatus = ON_CHAIN_STATUS[chainStatusNum];

        if (chainStatus && chainStatus !== market.status) {
          const updateData: any = { status: chainStatus };
          if (chainStatus === "resolved") {
            updateData.resolvedAt = new Date();
            const outcome = await contract.resolvedOutcome();
            updateData.resolvedOutcome = outcome;
          }
          if (chainStatus === "proposed") {
            updateData.proposedAt = new Date();
          }

          await prisma.market.update({
            where: { id: market.id },
            data: updateData,
          });
          synced++;
        }
      } catch (error) {
        // Non-critical: skip silently
      }
    }

    if (synced > 0) {
      console.log(`[MarketMonitor] Synced on-chain status for ${synced} market(s)`);
    }
  }
}

export const marketMonitor = new MarketMonitor();
