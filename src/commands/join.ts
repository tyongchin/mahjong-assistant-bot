import type { Env } from "../types/env";
import { addPlayerToSession, countPlayers, getActiveSessionId } from "../db/sessions";

export async function cmdJoin(
  env: Env,
  chatId: string,
  userId: string,
  username: string | null,
  displayName: string
): Promise<string> {
  const sessionId = await getActiveSessionId(env, chatId);
  if (sessionId === null) return "No active session. Start one with /newgame.";

  await addPlayerToSession(env, sessionId, userId, username, displayName);
  const c = await countPlayers(env, sessionId);

  return `✅ Joined session #${sessionId}.\nCurrent players: ${c}\nUse /status to see the list.`;
}
