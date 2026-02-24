import type { Request, Response, NextFunction } from "express";
import { PrivyClient } from "@privy-io/server-auth";
import { config } from "../../shared/config/env";

let privyClient: PrivyClient | null = null;

function getPrivyClient() {
  if (!privyClient && config.privyAppId && config.privyAppSecret) {
    privyClient = new PrivyClient(config.privyAppId, config.privyAppSecret);
  }
  return privyClient;
}

export interface AdminRequest extends Request {
  admin?: {
    privyUserId: string;
    email: string;
  };
}

export async function adminAuthMiddleware(
  req: AdminRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.slice(7);
  const client = getPrivyClient();
  if (!client) {
    return res.status(500).json({ error: "Auth not configured" });
  }

  if (!config.adminEmail) {
    return res.status(500).json({ error: "ADMIN_EMAIL not configured" });
  }

  try {
    const claims = await client.verifyAuthToken(token);
    const privyUser = await client.getUser(claims.userId);

    const email =
      privyUser.google?.email ||
      privyUser.email?.address ||
      (privyUser.linkedAccounts?.find((a: any) => a.type === "email") as any)?.address ||
      null;

    if (!email || email.toLowerCase() !== config.adminEmail.toLowerCase()) {
      return res.status(403).json({ error: "Forbidden: not an admin" });
    }

    req.admin = { privyUserId: claims.userId, email };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
