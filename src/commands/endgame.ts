import type { Env } from "../types/env";
import { getActiveSessionId, listPlayers } from "../db/sessions";
import { clearDraft, setResultState } from "../db/results";

export async function cmdEndGame(
    env: Env, 
    chatId: string
): Promise<string[]> {
  const sessionId = await getActiveSessionId(env, chatId);
  if (sessionId === null) return ["No active session to end. Use /newgame."];

  // Close the session
  await env.DB.prepare(`UPDATE sessions SET status = 'ended' WHERE id = ?`)
    .bind(sessionId)
    .run();

  // Prepare result collection state + clear any previous draft for safety
  await setResultState(env, chatId, sessionId, "awaiting_submit");
  await clearDraft(env, sessionId);

  const players = await listPlayers(env, sessionId);
  if (players.length === 0) {
    return [`Session #${sessionId} ended 🥳 (no players were in the session).`];
  }

  const template =
    `Session #${sessionId} ended 🥳\n` +
    `Rules:\n` +
    `- Integers only\n` +
    `- You can resubmit /resultsubmit anytime\n` +
    `- Call /resultfinalize when ready\n\n` +
    `Copy and fill the command in the message below:`;

  const command =
    `/resultsubmit\n` +
        players.map(p => {
        const name = p.username ? `@${p.username}` : (p.display_name ?? "Unknown");
        return `${name} 0`;
        }).join("\n");
    

  return [template, command];
}
