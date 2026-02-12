import type { Env } from "../types/env";
import { createSession, getActiveSessionId } from "../db/sessions";

export async function cmdNewGame(env: Env, chatId: string, userId: string): Promise<string> {
  const active = await getActiveSessionId(env, chatId);
  if (active !== null) return "There is already an active session. Use /status, /join, /leave. 🥺";

  const id = await createSession(env, chatId, userId);
  return `🀄 New mahjong session started! (session #${id})\nUse /join to join.`;
}
