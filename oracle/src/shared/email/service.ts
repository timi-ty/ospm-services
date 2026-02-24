import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { config } from "../config/env";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    console.warn("[Email] SMTP not configured, emails disabled");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });

  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;

  try {
    await t.sendMail({
      from: config.fromEmail,
      to,
      subject,
      html,
    });
    console.log(`[Email] Sent "${subject}" to ${to}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send "${subject}" to ${to}:`, error);
    return false;
  }
}
