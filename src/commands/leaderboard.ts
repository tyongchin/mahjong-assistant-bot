import type { Env } from "../types/env";
import { getLeaderboard } from "../db/leaderboard";
import { formatName, formatSigned } from "../utils/format";


export async function cmdLeaderboard(env: Env, chatId: string): Promise<string> {
    const rows = await getLeaderboard(env, chatId, 20);
    if (rows.length === 0) return "No leaderboard yet. Finalize a game first 🙂";

    const names = rows.map(r => formatName(r));
    const pointsStrs = rows.map(r => formatSigned(r.points));

    const maxNameLength = Math.max(...names.map(n => n.length));
    const maxPointsLength = Math.max(...pointsStrs.map(p => p.length));

    let out = "🏆 *Leaderboard*\n\n";

    for (let i = 0; i < rows.length; i++) {
        const rank = `${(i + 1).toString().padStart(2, " ")}.`;

        const name = names[i].padStart(maxNameLength, " ");
        const pts = pointsStrs[i].padStart(maxPointsLength, " ");

        out += `\`${rank} ${name} | ${pts}\`\n`;
    }

    return out.trimEnd();
}

