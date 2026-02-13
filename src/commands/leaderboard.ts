import type { Env } from "../types/env";
import { getLeaderboard } from "../db/leaderboard";
import { formatName, formatSigned } from "../utils/format";


export async function cmdLeaderboard(env: Env, chatId: string): Promise<string> {
    const rows = await getLeaderboard(env, chatId, 20);
    if (rows.length === 0) return "No leaderboard yet. Finalize a game first 🙂";

    let out = "🏆 Leaderboard\n\n";

    // Precompute formatted names/points so we can align columns nicely
    const names = rows.map(r => formatName(r));
    const pointsStrs = rows.map(r => formatSigned(r.points)); // Option 3: signed formatting

    const maxNameLength = Math.max(...names.map(n => n.length));
    const maxPointsLength = Math.max(...pointsStrs.map(p => p.length));

    for (let i = 0; i < rows.length; i++) {
        // Option 2: medals for top 3
        const rankLabel =
            i === 0 ? "🥇" :
            i === 1 ? "🥈" :
            i === 2 ? "🥉" :
            `${(i + 1).toString().padStart(2, " ")}.`;

        // Option 1: aligned columns
        const name = names[i].padEnd(maxNameLength, " ");
        const pts = pointsStrs[i].padStart(maxPointsLength, " ");

        out += `${rankLabel} ${name} — ${pts}\n`;
    }

    return out.trimEnd();
}
