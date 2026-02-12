import { BalanceEntry, PointsDelta } from "../types/domain.ts";

/**
 * Compute leaderboard point deltas from finalized session balances.
 *
 * Base rules:
 * - balance > 0 => +1
 * - balance < 0 => -1
 * - balance == 0 => 0
 *
 * Ranked bonuses (based on number of tables = players/4):
 * - top winner gets +tableCount, 2nd gets +(tableCount-1), ... down to +1
 * - top loser gets -tableCount, 2nd gets -(tableCount-1), ... down to -1
 *
 * Notes on ties:
 * - Ties share the same ranked bonus for that rank level (by unique balance value).
 * - This may award bonuses to more than tableCount players if there are ties at the boundary.
 */
export function computeSessionPointsFromBalances(
  balances: BalanceEntry[],
  resolveUserMeta: (id: string) => { username: string | null; display_name: string | null }
): PointsDelta[] {
    const winners = balances.filter(b => b.balance > 0);
    const losers  = balances.filter(b => b.balance < 0);

    // Each table has 4 players
    const tableCount = Math.max(1, Math.floor(balances.length / 4));

    // Start everyone at 0 so neutral players are included
    const map = new Map<string, PointsDelta>();
    for (const b of balances) {
        const meta = resolveUserMeta(b.id);
        map.set(b.id, {
        user_id: b.id,
        username: meta.username,
        display_name: meta.display_name,
        delta_points: 0,
        reason: "played(0)",
        });
    }

    // Base points
    for (const w of winners) {
        const cur = map.get(w.id)!;
        cur.delta_points += 1;
        cur.reason = "winner(+1)";
    }
    for (const l of losers) {
        const cur = map.get(l.id)!;
        cur.delta_points -= 1;
        cur.reason = "loser(-1)";
    }

    // Winner bonus (+1) to top N winners, with special tie-at-top rule
    if (winners.length > 0) {
        const max = Math.max(...winners.map(w => w.balance));
        const topGroup = winners.filter(w => w.balance === max);

        // Always award top place (can exceed N if all tied for top)
        for (const w of topGroup) {
            const cur = map.get(w.id)!;
            cur.delta_points += 1;
            cur.reason += cur.reason.includes("winner") ? ",topWinnerBonus(+1)" : "topWinnerBonus(+1)";
        }

        let remaining = tableCount - topGroup.length;

        // Only fill further if top place didn't already fill the quota
        if (remaining > 0) {
            // Group by balance (excluding max), descending
            const levelsDesc = Array.from(
                new Set(winners.filter(w => w.balance !== max).map(w => w.balance))
            ).sort((a, b) => b - a);

            for (const level of levelsDesc) {
                const group = winners.filter(w => w.balance === level);

                // Don't split ties: only award if the whole group fits
                if (group.length > remaining) break;

                for (const w of group) {
                    const cur = map.get(w.id)!;
                    cur.delta_points += 1;
                    cur.reason += cur.reason.includes("winner") ? ",topWinnerBonus(+1)" : "topWinnerBonus(+1)";
                }

                remaining -= group.length;
                if (remaining === 0) break;
            }
        }
    }

    // Loser penalty (-1) to top N losers, with special tie-at-bottom rule
    if (losers.length > 0) {
        const min = Math.min(...losers.map(l => l.balance)); // most negative
        const bottomGroup = losers.filter(l => l.balance === min);

        // Always penalize bottom place (can exceed N if all tied for bottom)
        for (const l of bottomGroup) {
            const cur = map.get(l.id)!;
            cur.delta_points -= 1;
            cur.reason += cur.reason.includes("loser") ? ",topLoserPenalty(-1)" : "topLoserPenalty(-1)";
        }

        let remaining = tableCount - bottomGroup.length;

        if (remaining > 0) {
            // Group by balance (excluding min), ascending (more negative first)
            const levelsAsc = Array.from(
                new Set(losers.filter(l => l.balance !== min).map(l => l.balance))
            ).sort((a, b) => a - b);

            for (const level of levelsAsc) {
                const group = losers.filter(l => l.balance === level);

                // Don't split ties
                if (group.length > remaining) break;

                for (const l of group) {
                    const cur = map.get(l.id)!;
                    cur.delta_points -= 1;
                    cur.reason += cur.reason.includes("loser") ? ",topLoserPenalty(-1)" : "topLoserPenalty(-1)";
                }

                remaining -= group.length;
                if (remaining === 0) break;
            }
        }
    }

    return [...map.values()];
}
