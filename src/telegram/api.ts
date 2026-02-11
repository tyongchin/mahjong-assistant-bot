import type { Env } from "../types/env";

export async function sendMessage(env: Env, chatId: number, text: string): Promise<void> {
  const resp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.log("Telegram sendMessage failed:", resp.status, body);
  }
}
