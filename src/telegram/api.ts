import type { Env } from "../types/env";

export async function sendMessage(
  env: Env,
  chatId: number,
  text: string,
  parseMode?: "Markdown"
): Promise<void> {
    const body: any = {
        chat_id: chatId,
        text,
    };

    // Only attach parse_mode if explicitly requested
    if (parseMode) {
        body.parse_mode = parseMode;
    }

    const resp = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        }
    );

    if (!resp.ok) {
        const errBody = await resp.text();
        console.log("Telegram sendMessage failed:", resp.status, errBody);
    }
}

export async function isAuthorized(
  env: Env,
  chatId: string,
  callerUserId: string
): Promise<boolean> {

    // 1: Check ENV admin list
    const admins = (env.ADMIN_USER_IDS ?? "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

    if (admins.includes(callerUserId)) {
        return true;
    }

    // 2: Check Telegram group role
    const resp = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getChatMember`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: Number(chatId),
            user_id: Number(callerUserId),
        }),
        }
    );

    const data = await resp.json() as { ok: boolean; result?: { status: string } };
    if (!data.ok) return false;
    const status = data.result?.status;
    return status === "creator" || status === "administrator";
}