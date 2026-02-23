import { config } from "../config/env";

export async function notifyAdmin(message: string): Promise<void> {
  console.log(`[ADMIN] ${message}`);

  const promises: Promise<void>[] = [];

  if (config.telegramBotToken && config.telegramChatId) {
    promises.push(sendTelegram(message));
  }

  if (config.discordWebhookUrl) {
    promises.push(sendDiscord(message));
  }

  await Promise.allSettled(promises);
}

async function sendTelegram(message: string): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: `🔮 OSPM Oracle\n\n${message}`,
        parse_mode: "HTML",
      }),
    });
    if (!res.ok) {
      console.warn(`[Notifications] Telegram failed: ${res.status}`);
    }
  } catch (error) {
    console.warn("[Notifications] Telegram error:", error);
  }
}

async function sendDiscord(message: string): Promise<void> {
  try {
    const res = await fetch(config.discordWebhookUrl!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🔮 **OSPM Oracle**\n\n${message}`,
      }),
    });
    if (!res.ok) {
      console.warn(`[Notifications] Discord failed: ${res.status}`);
    }
  } catch (error) {
    console.warn("[Notifications] Discord error:", error);
  }
}
