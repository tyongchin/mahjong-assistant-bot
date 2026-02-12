import type { Env } from "../types/env";
import { getActiveSessionId, listPlayers } from "../db/sessions";
import { shuffle } from "../utils/math";
import { formatName } from "../utils/format";


export async function cmdAssignTables(env: Env, chatId: string): Promise<string> {
  const sessionId = await getActiveSessionId(env, chatId);
  if (sessionId === null) return "No active session. Start one with /newgame.";

  const players = await listPlayers(env, sessionId);
  const n = players.length;

  if (n < 4) {
    return `Need at least 4 players to assign tables. Current players: ${n}.`;
  }

  const shuffled = shuffle(players);

  // Number of tables = ceil(n / 4)
  const tableCount = Math.ceil(n / 4);

  let output = "";

  for (let t = 0; t < tableCount; t++) {
    output += `Table ${t + 1}:\n`;

    for (let seat = 0; seat < 4; seat++) {
      const index = t * 4 + seat;
      if (index < n) {
        output += `${seat + 1}. ${formatName(shuffled[index])}\n`;
      } else {
        output += `${seat + 1}. -\n`;
      }
    }

    if (t !== tableCount - 1) {
      output += `\n`;
    }
  }

  return output.trimEnd();
}