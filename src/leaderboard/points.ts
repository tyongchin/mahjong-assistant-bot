import { BalanceEntry, PointsDelta } from "../types/domain.ts";

/**
 * Compute leaderboard point deltas from finalized session balances.
 *
 * Rules:
 * - balance > 0 => +1
 * - balance < 0 => -1
 * - top winner(s) get +1 extra (total +2)
 * - top loser(s) get -1 extra (total -2)
 */
export function computeSessionPointsFromBalances(
    balances: BalanceEntry[],
    resolveUserMeta: (id: string) => { username: string | null; display_name: string | null }
): PointsDelta[] {
    const winners = balances.filter(b => b.balance > 0);
    const losers  = balances.filter(b => b.balance < 0);

    // Start everyone at 0 so neutral players are included
    const map = new Map<string, PointsDelta>();
    for (const b of balances) {
        const meta = resolveUserMeta(b.id);
        map.set(b.id, {
        user_id: b.id,
        username: meta.username,
        display_name: meta.display_name,
        delta_points: 0,
        reason: "played(0)"
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

    // Top winner bonus (+1 extra)
    if (winners.length > 0) {
        const max = Math.max(...winners.map(w => w.balance));
        for (const tw of winners.filter(w => w.balance === max)) {
        const cur = map.get(tw.id)!;
        cur.delta_points += 1;
        cur.reason += cur.reason.includes("winner") ? ",topWinnerBonus(+1)" : "topWinnerBonus(+1)";
        }
    }

    // Top loser bonus (-1 extra)
    if (losers.length > 0) {
        const min = Math.min(...losers.map(l => l.balance));
        for (const tl of losers.filter(l => l.balance === min)) {
        const cur = map.get(tl.id)!;
        cur.delta_points -= 1;
        cur.reason += cur.reason.includes("loser") ? ",topLoserBonus(-1)" : "topLoserBonus(-1)";
        }
    }

    return [...map.values()];
}
