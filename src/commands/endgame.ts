import type { Env } from "../types/env";
import { getActiveSessionId, listPlayers } from "../db/sessions";

export async function cmdEndGame(
  env: Env,
  chatId: string
): Promise<string[]> {

  const sessionId = await getActiveSessionId(env, chatId);
  if (sessionId === null)
    return ["No active session. Use /newgame."];

  const players = await listPlayers(env, sessionId);

  if (players.length === 0) {
    return [`Session #${sessionId} has no players.`];
  }

  const message =
    `Session #${sessionId} results template 🧾\n\n` +
    `Rules:\n` +
    `- Integers only\n` +
    `- You can resubmit /resultsubmit anytime\n` +
    `- Call /resultfinalize when ready\n\n` +
    `Copy and fill the command below:`;

  const command =
    `/resultsubmit\n` +
    players.map(p => {
      const name = p.username
        ? `@${p.username}`
        : (p.display_name ?? "Unknown");
      return `${name} 0`;
    }).join("\n");

  return [message, command];
}
