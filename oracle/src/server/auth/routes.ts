import { Router } from "express";
import { PrivyClient } from "@privy-io/server-auth";
import { prisma } from "../../shared/database/prisma";
import { config } from "../../shared/config/env";
import { sendEmail } from "../../shared/email/service";
import { welcomeEmail } from "../../shared/email/templates";

const router = Router();

let privyClient: PrivyClient | null = null;
function getPrivyClient() {
  if (!privyClient && config.privyAppId && config.privyAppSecret) {
    privyClient = new PrivyClient(config.privyAppId, config.privyAppSecret);
  }
  return privyClient;
}

router.post("/verify", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "token required" });
    }

    const client = getPrivyClient();
    if (!client) {
      return res.status(500).json({ error: "Auth not configured" });
    }

    const claims = await client.verifyAuthToken(token);
    const privyUser = await client.getUser(claims.userId);

    const walletAccount = privyUser.linkedAccounts.find(
      (a: any) => a.type === "wallet" && a.walletClientType === "privy"
    );
    const address = (walletAccount as any)?.address || null;

    const email =
      privyUser.google?.email ||
      privyUser.email?.address ||
      (privyUser.linkedAccounts?.find((a: any) => a.type === "email") as any)?.address ||
      null;

    const existingUser = await prisma.user.findUnique({
      where: { privyUserId: claims.userId },
      select: { id: true },
    });
    const isNewUser = !existingUser;

    const user = await prisma.user.upsert({
      where: { privyUserId: claims.userId },
      update: { ...(address ? { address } : {}), ...(email ? { email } : {}) },
      create: {
        privyUserId: claims.userId,
        address: address || `pending-${claims.userId}`,
        email,
      },
    });

    const isTestUser =
      config.testUserEmail &&
      email?.toLowerCase() === config.testUserEmail.toLowerCase();

    console.log(`[Auth] User verified: email=${email}, isNew=${isNewUser}, isTest=${isTestUser}`);

    if (email && (isNewUser || isTestUser)) {
      sendEmail(email, "Welcome to OSPM", welcomeEmail()).catch((err) => {
        console.error("[Auth] Welcome email failed:", err);
      });
    }

    res.json({
      success: true,
      user: { id: user.id, privyUserId: user.privyUserId, address: user.address },
    });
  } catch (error: any) {
    console.error("Auth verify error:", error.message);
    return res.status(401).json({ error: "Invalid token" });
  }
});

export { router as authRouter };
