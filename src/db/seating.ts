import type { Env } from "../types/env";

export async function saveSeating(
  env: Env,
  sessionId: number,
  orderedUserIds: string[]
): Promise<void> {
    const stmts = orderedUserIds.map((userId, idx) => {
        const tableNo = Math.floor(idx / 4) + 1;
        const seatNo = (idx % 4) + 1;

        return env.DB.prepare(
        `UPDATE session_players
        SET table_no = ?, seat_no = ?
        WHERE session_id = ? AND user_id = ?`
        ).bind(tableNo, seatNo, sessionId, userId);
    });

    await env.DB.batch(stmts);
}
