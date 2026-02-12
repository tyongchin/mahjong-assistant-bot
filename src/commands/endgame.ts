import type { Env } from "../types/env";
import { getActiveSessionId, listPlayers } from "../db/sessions";
import { clearDraft, setResultState } from "../db/results";

export async function cmdEndGame(env: Env, chatId: string): Promise<string> {
  const sessionId = await getActiveSessionId(env, chatId);
  if (sessionId === null) return "No active session to end. Use /newgame.";

  // Close the session
  await env.DB.prepare(`UPDATE sessions SET status = 'ended' WHERE id = ?`)
    .bind(sessionId)
    .run();

  // Prepare result collection state + clear any previous draft for safety
  await setResultState(env, chatId, sessionId, "awaiting_submit");
  await clearDraft(env, sessionId);

  const players = await listPlayers(env, sessionId);
  if (players.length === 0) {
    return `Session #${sessionId} ended ✅ (no players were in the session).`;
  }

  // Template (integers only, + optional)
  let out =
    `Session #${sessionId} ended ✅\n` +
    `Submit results using this template (integers only; '+' optional):\n\n` +
    `/resultsubmit\n`;

  for (const p of players) {
    const name = p.username ? `@${p.username}` : (p.display_name ?? "Unknown");
    out += `${name} 0\n`;
  }

  out +=
    `\nRules:\n` +
    `- Values should sum to 0\n` +
    `- You can resubmit /resultsubmit to correct mistakes\n` +
    `- When ready, call /resultfinalize`;

  return out.trimEnd();
}
