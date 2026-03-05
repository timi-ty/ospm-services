import { config } from "../config/env";

function getLogoUrl(): string {
  const base = config.frontendUrls[0] || "http://localhost:3000";
  return `${base}/api/logo?size=96`;
}

function wrap(body: string): string {
  const logoUrl = getLogoUrl();
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;background:#ffffff;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="margin-bottom:24px;">
      <img src="${logoUrl}" alt="OSPM" style="height:48px;width:auto;" />
    </div>
    ${body}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#999;">
      OSPM &mdash; Open Source Prediction Markets
    </div>
  </div>
</body>
</html>`;
}

export function welcomeEmail(): string {
  return wrap(`
    <p style="font-size:15px;line-height:1.6;">Hey there,</p>
    <p style="font-size:15px;line-height:1.6;">
      Welcome to <strong>OSPM</strong> &mdash; Open Source Prediction Markets.
    </p>
    <p style="font-size:15px;line-height:1.6;">
      We create AI-generated prediction markets from real-world news. You can trade on outcomes
      using PLAY tokens, claim gas for transaction fees, and track your positions on the dashboard.
    </p>
    <p style="font-size:15px;line-height:1.6;">
      Jump in and start exploring the markets. If you have any questions, just reply to this email.
    </p>
    <p style="font-size:15px;line-height:1.6;">
      &mdash; Timi
    </p>
  `);
}

export function gasClaimEmail(txHash: string, amount: string): string {
  const explorerUrl = `https://sepolia.basescan.org/tx/${txHash}`;
  return wrap(`
    <p style="font-size:15px;line-height:1.6;">Hey,</p>
    <p style="font-size:15px;line-height:1.6;">
      Your gas claim of <strong>${amount} ETH</strong> was successful.
    </p>
    <p style="font-size:15px;line-height:1.6;">
      <a href="${explorerUrl}" style="color:#6B5D3E;">View transaction on BaseScan</a>
    </p>
    <p style="font-size:15px;line-height:1.6;">
      A quick note: this gas is <strong>real ETH on Base Sepolia</strong> that I pay for out of pocket
      so you can cover transaction fees. Please claim in moderation &mdash; only when you actually need
      gas for transactions.
    </p>
    <p style="font-size:15px;line-height:1.6;">
      The <strong>PLAY token</strong>, on the other hand, is a testnet token and completely free.
      Feel free to use as much as you want when trading on markets.
    </p>
    <p style="font-size:15px;line-height:1.6;">
      &mdash; Timi
    </p>
  `);
}
