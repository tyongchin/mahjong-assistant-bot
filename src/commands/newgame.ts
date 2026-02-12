import type { Env } from "../types/env";
import { createSession, getActiveSessionId } from "../db/sessions";

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

function parseTitle(rawText: string): string | null {
  const parts = rawText.trim().split(/\s+/);
  if (parts.length <= 1) return null;

  // Remove "/newgame" (first word) and join the rest
  return rawText.trim().substring(rawText.indexOf(" ") + 1).trim();
}
