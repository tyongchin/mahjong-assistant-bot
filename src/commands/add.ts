import type { Env } from "../types/env";
import {
  getActiveSessionId,
  addPlayerToSession,
  countPlayers,
} from "../db/sessions";
import {
  getDisplayNameByUserId,
  getUserIdByUsername,
  normalizeUsername,
} from "../db/players";
import { getResultState } from "../db/results";

/**
 * /add @alice
 * /add @alice @bob charlie
 *
 * Notes:
 * - Requires at least 1 username.
 * - Usernames may be with or without @.
 * - Unknown usernames are reported (ask them to speak once or /join).
 */
export async function cmdAdd(
  env: Env,
  chatId: string,
  rawText: string
): Promise<string> {
  const sessionId = await getActiveSessionId(env, chatId);
  if (sessionId === null) return "No active session. 😭 Use /newgame.";

  const state = await getResultState(env, chatId);
  if (state && state.session_id === sessionId) {
    return "Game is in results phase. Cannot add players now.";
  }

  // Extract everything after "/add" and split by whitespace.
  // This keeps it flexible: /add @a @b c
  const tokens = rawText
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  // tokens[0] should be "/add" (depending on your router, it might already be removed)
  // We'll handle both cases:
  const args =
    tokens.length > 0 && tokens[0].toLowerCase() === "/add"
      ? tokens.slice(1)
      : tokens;

  if (args.length === 0) return "Usage: /add @username [@username2 ...]";

  const added: string[] = [];
  const unknown: string[] = [];

  // Deduplicate inputs (case-insensitive after normalize)
  const seen = new Set<string>();

  for (const a of args) {
    const uname = normalizeUsername(a); // should handle optional '@'
    if (!uname) continue;

    const key = uname.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const targetUserId = await getUserIdByUsername(env, uname);
    if (!targetUserId) {
      unknown.push(uname);
      continue;
    }

    const displayName = (await getDisplayNameByUserId(env, targetUserId)) || uname;

    // Add to session (assumes DB layer handles "already in session" safely;
    // if not, you can catch/ignore unique constraint errors here.)
    await addPlayerToSession(env, sessionId, targetUserId, uname, displayName);
    added.push(displayName);
  }

  const c = await countPlayers(env, sessionId);

  let out = "";

  if (added.length > 0) {
    out += `🥳 Added to session #${sessionId}:\n- ${added.join("\n- ")}\n`;
  } else {
    out += `No players were added.\n`;
  }

  if (unknown.length > 0) {
    out +=
      `\nI don't recognize these usernames yet:\n- ${unknown.join("\n- ")}\n` +
      `Ask them to send any message in this group (or /join once) so I can learn their username.`;
  }

  out += `\n\nCurrent players: ${c}\nUse /status to see the list.`;

  return out.trimEnd();
}