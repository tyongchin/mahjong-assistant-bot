import type { Env } from "../types/env";
import { getLeaderboard } from "../db/leaderboard";
import { formatName } from "../utils/format";

export async function cmdLeaderboard(env: Env, chatId: string): Promise<string> {
    const rows = await getLeaderboard(env, chatId, 20);

    if (rows.length === 0) return "No leaderboard yet. Finalize a game first 🙂";

    let out = "🏆 Leaderboard\n";
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const name = formatName(r);
        out += `${i + 1}. ${name} — ${r.points}\n`;
    }
    return out.trimEnd();
}
