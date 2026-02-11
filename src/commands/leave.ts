import type { Env } from "../types/env";
import { getActiveSessionId, removePlayerFromSession } from "../db/sessions";

export async function cmdLeave(env: Env, chatId: string, userId: string): Promise<string> {
  const sessionId = await getActiveSessionId(env, chatId);
  if (sessionId === null) return "No active session right now.";

  const removed = await removePlayerFromSession(env, sessionId, userId);
  if (removed === 0) return "You weren’t in the current session. Use /join to join.";

  return `✅ Left session #${sessionId}.`;
}
