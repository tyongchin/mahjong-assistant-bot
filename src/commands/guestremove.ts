import type { Env } from "../types/env";
import { getActiveSessionId, removePlayerFromSession } from "../db/sessions";
import { getVirtualUserIdByName } from "../db/players";
import { getResultState } from "../db/results";
import { normalizeUsername } from "../db/players";

export async function cmdGuestRemove(env: Env, chatId: string, rawText: string): Promise<string> {
  const sessionId = await getActiveSessionId(env, chatId);
  if (sessionId === null) return "No active session.";

  const state = await getResultState(env, chatId);
  if (state && state.session_id === sessionId) return "Game is in results phase. Cannot remove guests now.";

  const parts = rawText.trim().split(/\s+/);
  if (parts.length < 2) return "Usage: /guestremove Name";

  const name = normalizeUsername(parts.slice(1).join(" "));
  const userId = await getVirtualUserIdByName(env, chatId, name);

  if (!userId) return `No guest "${name}" found for this group.`;

  await removePlayerFromSession(env, sessionId, userId);
  return `✅ Removed guest "${name}" from session #${sessionId}.`;
}
