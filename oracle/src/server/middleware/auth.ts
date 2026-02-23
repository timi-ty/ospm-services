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

export interface AuthenticatedRequest extends Request {
  user?: {
    privyUserId: string;
    address?: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
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

  try {
    const claims = await client.verifyAuthToken(token);
    req.user = {
      privyUserId: claims.userId,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
