import type { Env } from "../types/env";
import { getActiveSessionId, listPlayers } from "../db/sessions";

export async function cmdStatus(env: Env, chatId: string): Promise<string> {
  const sessionId = await getActiveSessionId(env, chatId);
  if (sessionId === null) return "No active session. Use /newgame to start one.";

  const players = await listPlayers(env, sessionId);
  if (players.length === 0) return `Session #${sessionId} is active, but nobody has joined yet.\nUse /join.`;

  const lines = players.map((p, i) => {
    const name = p.username ? `@${p.username}` : (p.display_name ?? "Unknown");
    return `${i + 1}. ${name}`;
  });

  return `🀄 Session #${sessionId} (active)\nPlayers:\n${lines.join("\n")}`;
}
