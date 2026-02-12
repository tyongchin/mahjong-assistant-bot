import type { Env } from "../types/env";
import { getResultState, clearDraft, writeDraft, sumDraft } from "../db/results";
import { listPlayers } from "../db/sessions";
import { getUserIdByUsername } from "../db/players";
import { formatName, formatSigned } from "../utils/format";
import { parseSubmit } from "../utils/parse";

export async function cmdResultSubmit(env: Env, chatId: string, rawText: string): Promise<string> {
  const state = await getResultState(env, chatId);
  if (!state) return "No ended session is awaiting results. Use /endgame first.";

  const sessionId = state.session_id;
  const sessionPlayers = await listPlayers(env, sessionId);

  if (sessionPlayers.length === 0) {
    return "That ended session had no players.";
  }

  const parsed = parseSubmit(rawText);
  if (parsed.length === 0) {
    return (
      "Usage:\n" +
      "/resultsubmit\n" +
      "@alice 12\n" +
      "@bob -8\n" +
      "@charlie -4\n" +
      "@david 0"
    );
  }

  // Who is actually in session (by user_id)
  const expectedUserIds = new Set(sessionPlayers.map((p) => p.user_id));

  // Resolve usernames -> user_id
  const rowsToInsert: Array<{ userId: string; delta: number }> = [];
  const badLines: string[] = [];
  const notInSession: string[] = [];
  const unknownUsers: string[] = [];

  for (const line of parsed) {
    const userId = await getUserIdByUsername(env, line.username);
    if (!userId) {
      unknownUsers.push(formatName({ user_id: "", username: line.username, display_name: null }));
      continue;
    }
    if (!expectedUserIds.has(userId)) {
      notInSession.push(formatName({ user_id: userId, username: line.username, display_name: null }));
      continue;
    }
    rowsToInsert.push({ userId, delta: line.delta });
  }

  // Overwrite draft on every submit (resubmission-friendly)
  await clearDraft(env, sessionId);
  await writeDraft(env, sessionId, rowsToInsert);

  const net = await sumDraft(env, sessionId);

  // Compute missing players from the session
  const provided = new Set(rowsToInsert.map((r) => r.userId));
  const missing = sessionPlayers
    .filter((p) => !provided.has(p.user_id))
    .map((p) => formatName(p));

  let out = `✅ Draft results saved for session #${sessionId}.\n`;

  if (unknownUsers.length > 0) {
    out += `\nUnrecognized usernames (bot hasn't learned them yet):\n- ${unknownUsers.join("\n- ")}`;
  }
  if (notInSession.length > 0) {
    out += `\n\nThese users are not in the ended session:\n- ${notInSession.join("\n- ")}`;
  }
  if (missing.length > 0) {
    out += `\n\nMissing players (not provided in your submission):\n- ${missing.join("\n- ")}`;
  }

  if (net !== 0) {
    out += `\n\n⚠️ Totals don’t sum to 0. Net = ${formatSigned(net)}.\n`;
    if (net > 0) {
      out += `You have ${formatSigned(net)} extra (someone needs to lose ${net}).\n`;
    } else {
      out += `You are missing +${Math.abs(net)} (someone needs to win ${Math.abs(net)}).\n`;
    }
    out += `Resubmit /resultsubmit to correct, or call /resultfinalize to finalize anyway.`;
  } else {
    out += `\n\n✅ Totals sum to 0.\n`;
    out += `You can resubmit /resultsubmit if you want to correct anything.\n`;
    out += `When ready, call /resultfinalize.`;
  }

  return out.trimEnd();
}
