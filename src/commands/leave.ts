import type { Env } from "../types/env";
import { getActiveSessionId, removePlayerFromSession } from "../db/sessions";
import { getResultState } from "../db/results";

export async function cmdLeave(env: Env, chatId: string, userId: string): Promise<string> {
    const sessionId = await getActiveSessionId(env, chatId);
    if (sessionId === null) return "No active session. 😭";

    const state = await getResultState(env, chatId);
    if (state && state.session_id === sessionId) {
        return "Game is in results phase. Cannot leave now.";
    }

    const removed = await removePlayerFromSession(env, sessionId, userId);
    if (removed === 0) return "You aren't in the current session. 😪";

    return `😒 Left session #${sessionId}.`;
}
