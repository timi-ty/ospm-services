import { ethers } from "ethers";
import { config } from "../config/env";

export const provider = new ethers.JsonRpcProvider(config.rpcUrl);

export const oracleWallet = new ethers.Wallet(config.oraclePrivateKey, provider);

export async function checkConnection(): Promise<boolean> {
  try {
    const network = await provider.getNetwork();
    console.log(`✓ Connected to chain ${network.chainId}`);
    return true;
  } catch (error) {
    console.error("✗ Blockchain connection failed:", error);
    return false;
  }
}
