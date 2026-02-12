import type { Env } from "../types/env";
import { getActiveSession, listPlayers } from "../db/sessions";

export async function cmdStatus(env: Env, chatId: string): Promise<string> {
  const session = await getActiveSession(env, chatId);
  if (session === null) return "No active session. Use /newgame to start one.";

  const players = await listPlayers(env, session.id);
  if (players.length === 0) return `Session #${session.id} is active, but nobody has joined yet.\nUse /join.`;

  // Group by table_no
  const tables = new Map<number, typeof players>();
  for (const p of players) {
    const t = p.table_no ?? 1; // fallback
    if (!tables.has(t)) tables.set(t, []);
    tables.get(t)!.push(p);
  }

  // Sort within each table by seat_no (fallback to joined order)
  const tableNos = Array.from(tables.keys()).sort((a, b) => a - b);

  let out = "";
  out += `🀄 Session #${session.id} (active)${session.title ? ` - ${session.title}` : ""}\n`;
  for (const t of tableNos) {
    out += `Table ${t}:\n`;
    const list = tables.get(t)!;
    list.sort((a, b) => (a.seat_no ?? 999) - (b.seat_no ?? 999));
    for (const p of list) {
      const name = p.username ? `${p.username}` : (p.display_name ?? "Unknown");
      out += `- ${name}\n`;
    }
    out += `\n`;
  }

  return out.trimEnd();
}
