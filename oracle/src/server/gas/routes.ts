import { Router } from "express";
import { ethers } from "ethers";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth";
import { provider, getOracleWallet } from "../../shared/blockchain/client";
import { prisma } from "../../shared/database/prisma";

const router = Router();

const GAS_AMOUNT = ethers.parseEther("0.001");
const LOW_BALANCE_THRESHOLD = ethers.parseEther("0.0005");
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

router.post("/request", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { privyUserId: req.user!.privyUserId },
      select: { address: true, lastGasClaimAt: true },
    });

    if (!user) {
      return res.status(400).json({ error: "User not registered" });
    }

    const address = user.address;

    if (user.lastGasClaimAt && Date.now() - user.lastGasClaimAt.getTime() < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - user.lastGasClaimAt.getTime())) / 3600000);
      return res.status(429).json({ error: `Gas cooldown active. Try again in ~${remaining}h` });
    }

    const balance = await provider.getBalance(address);
    if (balance >= LOW_BALANCE_THRESHOLD) {
      return res.status(400).json({ error: "Balance sufficient, no gas needed" });
    }

    const wallet = getOracleWallet();
    const tx = await wallet.sendTransaction({
      to: address,
      value: GAS_AMOUNT,
    });
    await tx.wait();

    await prisma.user.update({
      where: { address },
      data: { lastGasClaimAt: new Date() },
    });

    console.log(`[Gas] Sent 0.001 ETH to ${address} (tx: ${tx.hash})`);

    res.json({
      success: true,
      txHash: tx.hash,
      amount: "0.001",
    });
  } catch (error: any) {
    console.error("POST /gas/request error:", error);
    res.status(500).json({ error: error.message || "Failed to send gas" });
  }
});

export { router as gasRouter };
