import { BalanceEntry, PointsDelta } from "../types/domain.ts";

/**
 * Compute leaderboard point deltas from finalized session balances.
 *
 * Rules:
 * - n = number of tables = players / 4
 * - top winner(s) get +n (ties allowed: all tied top winners get it)
 * - top loser(s) get -n (ties allowed: all tied top losers get it)
 * - everyone else gets 0
 *
 * Important: returns an entry for EVERY player (played(0)) so DB writes happen for all.
 */
export function computeSessionPointsFromBalances(
  balances: BalanceEntry[],
  resolveUserMeta: (id: string) => { username: string | null; display_name: string | null }
): PointsDelta[] {
  const tableCount = Math.max(1, Math.floor(balances.length / 4));

  const winners = balances.filter(b => b.balance > 0);
  const losers  = balances.filter(b => b.balance < 0);

  // Start everyone at 0 so neutral players are included (and DB gets rows for all players)
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

  // Top winner(s): +n (ties allowed)
  if (winners.length > 0) {
    const maxWin = Math.max(...winners.map(w => w.balance));
    for (const w of winners) {
      if (w.balance === maxWin) {
        const cur = map.get(w.id)!;
        cur.delta_points += tableCount;
        cur.reason += `,topWinner(+${tableCount})`;
      }
    }
  }

  // Top loser(s): -n (ties allowed)
  if (losers.length > 0) {
    const minLoss = Math.min(...losers.map(l => l.balance));
    for (const l of losers) {
      if (l.balance === minLoss) {
        const cur = map.get(l.id)!;
        cur.delta_points -= tableCount;
        cur.reason += `,topLoser(-${tableCount})`;
      }
    }
  }

  return [...map.values()];
}