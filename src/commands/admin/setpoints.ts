import type { Env } from "../../types/env";
import { getUserIdByUsername } from "../../db/players";
import { isAuthorized } from "../../telegram/api";

export async function cmdSetPoints(
  env: Env,
  chatId: string,
  callerUserId: string,
  rawText: string
): Promise<string> {

    const authorized = await isAuthorized(env, chatId, callerUserId);
    if (!authorized) {
        return "Only group owners/admins can use this command.";
    }

    const parts = rawText.trim().split(/\s+/);
    if (parts.length < 3) {
        return "Usage: /setpoints @username 10";
    }

    const usernameRaw = parts[1];
    const username = usernameRaw.startsWith("@") ? usernameRaw.slice(1) : usernameRaw;

    const points = Number(parts[2]);
    if (!Number.isInteger(points)) {
        return "Points must be an integer.";
    }

    const userId = await getUserIdByUsername(env, username);
    if (!userId) {
        return `Unknown user ${username}. (Bot must have seen them before.)`;
    }

    const now = Date.now();

    await env.DB.prepare(
        `
        INSERT INTO leaderboard (chat_id, user_id, username, display_name, points, updated_at)
        VALUES (?, ?, ?, NULL, ?, ?)
        ON CONFLICT(chat_id, user_id) DO UPDATE SET
        points = excluded.points,
        username = excluded.username,
        updated_at = excluded.updated_at
        `
    ).bind(chatId, userId, username, points, now).run();

    return `✅ Set ${username} points to ${points}.`;
}

