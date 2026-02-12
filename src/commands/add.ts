import type { Env } from "../types/env";
import { getActiveSessionId, addPlayerToSession, countPlayers } from "../db/sessions";
import { getUserIdByUsername, normalizeUsername } from "../db/players";
import { parseSingleUsernameArg } from "../utils/parse";
import { getResultState } from "../db/results";

export async function cmdAdd(
  env: Env,
  chatId: string,
  rawText: string
): Promise<string> {
    const sessionId = await getActiveSessionId(env, chatId);
    if (sessionId === null) return "No active session. 😭 Use /newgame.";

    const state = await getResultState(env, chatId);
    if (state && state.session_id === sessionId) {
        return "Game is in results phase. Cannot add players now.";
    }

    const target = parseSingleUsernameArg(rawText);
    if (!target) return "Usage: /add @username";

    const uname = normalizeUsername(target);
    const targetUserId = await getUserIdByUsername(env, uname);

    if (!targetUserId) {
        return (
        `I don't recognize @${uname} yet.\n` +
        `Ask them to send any message in this group (or /join once) so I can learn their username.`
        );
    }

    // We don't know their latest display name here unless stored; use @username as display_name fallback.
    await addPlayerToSession(env, sessionId, targetUserId, uname, `@${uname}`);
    
    const c = await countPlayers(env, sessionId);

    return `🥳 Added ${uname} to session #${sessionId}.\nCurrent players: ${c}\nUse /status to see the list.`;
}


