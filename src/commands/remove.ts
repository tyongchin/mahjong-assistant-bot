import type { Env } from "../types/env";
import { getActiveSessionId, removePlayerFromSession, countPlayers } from "../db/sessions";
import { getUserIdByUsername, normalizeUsername } from "../db/players";
import { parseSingleUsernameArg } from "../utils/parse";
import { getResultState } from "../db/results";

export async function cmdRemove(
  env: Env,
  chatId: string,
  rawText: string
): Promise<string> {
    const sessionId = await getActiveSessionId(env, chatId);
    if (sessionId === null) return "No active session. 😭";

    const state = await getResultState(env, chatId);
    if (state && state.session_id === sessionId) {
        return "Game is in results phase. Cannot remove players now.";
    }

    const target = parseSingleUsernameArg(rawText);
    if (!target) return "Usage: /remove @username";

    const uname = normalizeUsername(target);
    const targetUserId = await getUserIdByUsername(env, uname);

    if (!targetUserId) {
        return `I don't recognize @${uname} yet, so I can't remove them by username.`;
    }

    const removed = await removePlayerFromSession(env, sessionId, targetUserId);
    if (removed === 0) return `@${uname} is not in the current session.`;

    const c = await countPlayers(env, sessionId);

    return `😒 Removed ${uname} from session #${sessionId}.\nCurrent players: ${c}\nUse /status to see the list.`;
}
