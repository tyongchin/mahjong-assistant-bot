import type { Env } from "../types/env";
import { getLeaderboard } from "../db/leaderboard";

export async function cmdLeaderboard(env: Env, chatId: string): Promise<string> {
    const rows = await getLeaderboard(env, chatId, 20);

    if (rows.length === 0) return "No leaderboard yet. Finalize a game first 🙂";

    let out = "🏆 Leaderboard\n";
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const name = r.username ? `${r.username}` : (r.display_name ?? "Unknown");
        out += `${i + 1}. ${name} — ${r.points}\n`;
    }
    return out.trimEnd();
}
