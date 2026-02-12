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
  resolveUserMeta: (id: string) => { username: string | null; displayName: string | null }
): PointsDelta[] {

  const winners = balances.filter(b => b.balance > 0);
  const losers  = balances.filter(b => b.balance < 0);

  const map = new Map<string, PointsDelta>();

  // Base points
  for (const w of winners) {
    const meta = resolveUserMeta(w.id);
    map.set(w.id, {
      userId: w.id,
      username: meta.username,
      displayName: meta.displayName,
      deltaPoints: 1,
      reason: "winner(+1)"
    });
  }

  for (const l of losers) {
    const meta = resolveUserMeta(l.id);
    map.set(l.id, {
      userId: l.id,
      username: meta.username,
      displayName: meta.displayName,
      deltaPoints: -1,
      reason: "loser(-1)"
    });
  }

  // Top winner bonus
  if (winners.length > 0) {
    const max = Math.max(...winners.map(w => w.balance));
    const topWinners = winners.filter(w => w.balance === max);

    for (const tw of topWinners) {
      const cur = map.get(tw.id);
      if (cur) {
        cur.deltaPoints += 1;
        cur.reason += ",topWinnerBonus(+1)";
      }
    }
  }

  // Top loser bonus
  if (losers.length > 0) {
    const min = Math.min(...losers.map(l => l.balance)); // most negative
    const topLosers = losers.filter(l => l.balance === min);

    for (const tl of topLosers) {
      const cur = map.get(tl.id);
      if (cur) {
        cur.deltaPoints -= 1;
        cur.reason += ",topLoserBonus(-1)";
      }
    }
  }

  // Remove zero changes (e.g. if someone had 0 balance)
  return [...map.values()].filter(x => x.deltaPoints !== 0);
}