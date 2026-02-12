import type { Env } from "../types/env";
import { sendMessage } from "../telegram/api";

const DAY = 24 * 60 * 60 * 1000;
const THIRTY_DAYS = 30 * DAY;
const WARNING_THRESHOLD = 23 * DAY; // 1 week before 30 days

export async function runDecay(env: Env): Promise<void> {
    const now = Date.now();
    const decayCutoff = now - THIRTY_DAYS;
    const warningCutoff = now - WARNING_THRESHOLD;

    // Fetch all leaderboard rows
    const res = await env.DB.prepare(
        `
        SELECT chat_id, user_id, username, display_name, points, updated_at
        FROM leaderboard
        `
    ).all<{
        chat_id: string;
        user_id: string;
        username: string | null;
        display_name: string | null;
        points: number;
        updated_at: number;
    }>();

    const rows = res.results ?? [];
    if (rows.length === 0) return;

    // Group by chat
    const byChat = new Map<string, typeof rows>();

    for (const r of rows) {
        if (!byChat.has(r.chat_id)) byChat.set(r.chat_id, []);
        byChat.get(r.chat_id)!.push(r);
    }

    for (const [chatId, players] of byChat.entries()) {
        const decayed: string[] = [];
        const warnings: string[] = [];
        const updateStmts = [];

        for (const p of players) {
            const inactiveFor = now - p.updated_at;
            const name = p.username
                ? `@${p.username}`
                : (p.display_name ?? "Unknown");

            if (inactiveFor >= THIRTY_DAYS) {
                updateStmts.push(
                env.DB.prepare(
                    `
                    UPDATE leaderboard
                    SET points = points - 1,
                        updated_at = ?
                    WHERE chat_id = ? AND user_id = ?
                    `
                ).bind(now, chatId, p.user_id)
                );
                decayed.push(name);
            } 
            else if (inactiveFor >= WARNING_THRESHOLD) {
                const daysLeft = Math.ceil((THIRTY_DAYS - inactiveFor) / DAY);
                warnings.push(`${name} (${daysLeft}d left)`);
            }
        }


        if (updateStmts.length > 0) {
            await env.DB.batch(updateStmts);
        }

        if (decayed.length === 0 && warnings.length === 0) {
            continue; // Nothing to report
        }

        // Construct message
        let message = `📉 Weekly Activity Check\n`;
        if (decayed.length > 0) {
            message += `\n🟥 Decayed (-1 point):\n- ${decayed.join("\n- ")}\n`;
        }
        if (warnings.length > 0) {
            message += `\n🟨 In danger:\n- ${warnings.join("\n- ")}\n`;
        }
        message += `\nPlay a game to reset inactivity timer 🎴`;

        // Send message to chat
        await sendMessage(env, Number(chatId), message.trim());
    }
}
