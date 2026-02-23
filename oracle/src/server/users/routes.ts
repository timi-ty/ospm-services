import { Router } from "express";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../../shared/database/prisma";
import { getUserBets } from "./service";
import { syncUserBetsFromChain } from "./sync";

const router = Router();

// GET /api/users/:address/bets — requires auth, user can only see own bets
router.get("/:address/bets", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { address } = req.params;

    // Look up user by privyUserId, auto-register if not found
    let dbUser = await prisma.user.findUnique({
      where: { privyUserId: req.user!.privyUserId },
      select: { id: true, address: true },
    });

    if (!dbUser) {
      try {
        dbUser = await prisma.user.create({
          data: {
            privyUserId: req.user!.privyUserId,
            address: address,
          },
          select: { id: true, address: true },
        });
      } catch (e: any) {
        if (e.code === "P2002") {
          dbUser = await prisma.user.findUnique({
            where: { privyUserId: req.user!.privyUserId },
            select: { id: true, address: true },
          });
        }
        if (!dbUser) return res.json([]);
      }
    }

    if (dbUser.address.toLowerCase() !== address.toLowerCase()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Sync bets from chain before returning (best-effort, don't block on failure)
    try {
      await syncUserBetsFromChain(dbUser.id, address);
    } catch (e) {
      console.warn("[UserBets] Chain sync failed, returning DB state:", e);
    }

    const bets = await getUserBets(address);
    res.json(bets);
  } catch (error) {
    console.error("GET /users/:address/bets error:", error);
    res.status(500).json({ error: "Failed to fetch user bets" });
  }
});

export { router as usersRouter };
