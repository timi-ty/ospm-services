import { ethers } from "ethers";
import { config } from "../config/env";

export const provider = new ethers.JsonRpcProvider(config.rpcUrl);

let _wallet: ethers.Wallet = new ethers.Wallet(config.oraclePrivateKey, provider);

export function getOracleWallet(): ethers.Wallet {
  return _wallet;
}

export function setOracleWallet(privateKey: string): ethers.Wallet {
  _wallet = new ethers.Wallet(privateKey, provider);
  console.log(`[Wallet] Updated oracle wallet: ${_wallet.address}`);
  return _wallet;
}

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
