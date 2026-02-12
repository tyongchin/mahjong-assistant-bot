import type { Env } from "../types/env";

export async function applyPointsBatch(
    env: Env,
    chatId: string,
    sessionId: number,
    rows: Array<{
        user_id: string;
        username: string | null;
        display_name: string | null;
        delta: number;     // point change (can be 0)
        reason: string;    // explanation (only logged if delta != 0)
    }>
): Promise<void> {
    if (rows.length === 0) return;

    const now = Date.now();

    const statements = rows.flatMap((r) => {
        // Always upsert leaderboard to refresh updated_at
        const upsert = env.DB.prepare(
        `
        INSERT INTO leaderboard (chat_id, user_id, username, display_name, points, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(chat_id, user_id) DO UPDATE SET
            points = points + excluded.points,
            username = excluded.username,
            display_name = excluded.display_name,
            updated_at = excluded.updated_at
        `
        ).bind(
        chatId,
        r.user_id,
        r.username,
        r.display_name,
        r.delta,   // 0 is allowed (will just refresh updated_at)
        now
        );

        // Only log non-zero changes
        if (r.delta === 0) {
            return [upsert];
        }

        const logInsert = env.DB.prepare(
        `
        INSERT INTO leaderboard_log
            (chat_id, session_id, user_id, delta_points, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        `
        ).bind(
        chatId,
        sessionId,
        r.user_id,
        r.delta,
        r.reason,
        now
        );

        return [upsert, logInsert];
    });

    await env.DB.batch(statements);
}

export interface LeaderRow {
    user_id: string;
    username: string | null;
    display_name: string | null;
    points: number;
}

export async function getLeaderboard(env: Env, chatId: string, limit = 20): Promise<LeaderRow[]> {
    const res = await env.DB.prepare(
        `SELECT user_id, username, display_name, points
        FROM leaderboard
        WHERE chat_id = ?
        ORDER BY points DESC, updated_at DESC
        LIMIT ?`
    ).bind(chatId, limit).all<LeaderRow>();

    return res.results ?? [];
}
