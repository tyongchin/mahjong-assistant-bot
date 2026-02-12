import type { Env } from "../types/env";
import { createSession, getActiveSessionId } from "../db/sessions";
import { parseTitle } from "../utils/parse";

export async function cmdNewGame(
  env: Env,
  chatId: string,
  userId: string,
  rawText: string
): Promise<string> {
  const active = await getActiveSessionId(env, chatId);
  if (active !== null)
    return "There is already an active session. Use /status, /join, /leave. 🥺";

  // Everything after "/newgame"
  const title = parseTitle(rawText);

  const id = await createSession(env, chatId, userId, title);

  if (title) {
    return `🀄 New mahjong session started! (session #${id})\nTitle: ${title}\nUse /join to join.`;
  }

  return `🀄 New mahjong session started! (session #${id})\nUse /join to join.`;
}


