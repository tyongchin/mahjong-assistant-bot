import type { Env } from "../types/env";
import { getActiveSessionId, addPlayerToSession, countPlayers } from "../db/sessions";
import { createOrGetVirtualPlayer } from "../db/players";
import { getResultState } from "../db/results";

export async function cmdGuestAdd(env: Env, chatId: string, rawText: string): Promise<string> {
    const sessionId = await getActiveSessionId(env, chatId);
    if (sessionId === null) return "No active session.";

    // block during results phase
    const state = await getResultState(env, chatId);
    if (state && state.session_id === sessionId) return "Game is in results phase. Cannot add guests now.";

    const parts = rawText.trim().split(/\s+/);

    // Must be exactly: /guestadd <name>
    if (parts.length !== 2) {
        return "Usage: /guestadd <name> (one word only, no spaces)";
    }

    const name = parts[1].trim();
    if (!name) return "Usage: /guestadd <name> (one word only, no spaces)";

    // Optional: disallow @ prefix
    const cleaned = name.startsWith("@") ? name.slice(1) : name;

    const guest = await createOrGetVirtualPlayer(env, chatId, cleaned);

    await addPlayerToSession(env, sessionId, guest.userId, guest.username, guest.displayName);
    const c = await countPlayers(env, sessionId);

    return `✅ Added guest "${guest.displayName}" to session #${sessionId}.\nCurrent players: ${c}`;
}
