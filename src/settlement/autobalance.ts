import type { BalanceEntry, AutoBalanceResult } from "../types/domain";

export function autoBalanceToZero(entries: BalanceEntry[]): AutoBalanceResult {
  const netBefore = sum(entries);

  if (netBefore === 0) {
    return { adjusted: entries, netBefore, appliedNet: 0, note: null };
  }

  // Copy so we don't mutate callers
  const adjusted = entries.map(e => ({ ...e }));

  if (netBefore > 0) {
    // Extra money: give to losers proportional to their losses
    const losers = adjusted.filter(e => e.balance < 0);
    const totalLoss = losers.reduce((s, e) => s + (-e.balance), 0);

    if (totalLoss === 0) {
      // No losers to absorb extra; cannot distribute. Leave as-is.
      return {
        adjusted,
        netBefore,
        appliedNet: 0,
        note: `Net is +${netBefore} but there are no losers to absorb extra.`
      };
    }

    const alloc = allocateProportional(
      losers.map(e => ({ id: e.id, weight: -e.balance })),
      netBefore
    );

    for (const { id, amount } of alloc) {
      const p = adjusted.find(e => e.id === id)!;
      p.balance += amount; // reduce how much they owe
    }

    return {
      adjusted,
      netBefore,
      appliedNet: netBefore,
      note: `Auto-balanced +${netBefore} extra by distributing to losers proportionally.`
    };
  } else {
    // Missing money: take from winners proportional to their winnings
    const missing = -netBefore;
    const winners = adjusted.filter(e => e.balance > 0);
    const totalWin = winners.reduce((s, e) => s + e.balance, 0);

    if (totalWin === 0) {
      return {
        adjusted,
        netBefore,
        appliedNet: 0,
        note: `Net is ${netBefore} but there are no winners to deduct from.`
      };
    }

    const alloc = allocateProportional(
      winners.map(e => ({ id: e.id, weight: e.balance })),
      missing
    );

    for (const { id, amount } of alloc) {
      const p = adjusted.find(e => e.id === id)!;
      p.balance -= amount; // reduce how much they receive
    }

    return {
      adjusted,
      netBefore,
      appliedNet: missing,
      note: `Auto-balanced ${netBefore} missing by deducting from winners proportionally.`
    };
  }
}

function sum(entries: BalanceEntry[]): number {
  let s = 0;
  for (const e of entries) s += e.balance;
  return s;
}

/**
 * Allocate `total` (integer >= 0) across items with weights (integer > 0)
 * using largest-remainder method:
 *  - base = floor(total * w / W)
 *  - distribute leftover to biggest fractional remainders
 */
function allocateProportional(
  items: Array<{ id: string; weight: number }>,
  total: number
): Array<{ id: string; amount: number }> {
  if (total <= 0) return items.map(x => ({ id: x.id, amount: 0 }));

  const W = items.reduce((s, x) => s + x.weight, 0);
  if (W <= 0) return items.map(x => ({ id: x.id, amount: 0 }));

  // Compute exact shares
  const tmp = items.map(x => {
    const exact = (total * x.weight) / W;
    const base = Math.floor(exact);
    const frac = exact - base;
    return { id: x.id, base, frac };
  });

  let used = tmp.reduce((s, x) => s + x.base, 0);
  let left = total - used;

  // Distribute remainder by descending fractional remainder,
  // tie-breaker: bigger weight first (slightly fairer), then id.
  tmp.sort((a, b) => {
    if (b.frac !== a.frac) return b.frac - a.frac;
    // fallback stable-ish tie-breaker
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  for (let i = 0; i < tmp.length && left > 0; i++) {
    tmp[i].base += 1;
    left -= 1;
    // continue cycling if left still remains
    if (i === tmp.length - 1 && left > 0) i = -1;
  }

  // Return amounts in original item order
  const byId = new Map(tmp.map(x => [x.id, x.base]));
  return items.map(x => ({ id: x.id, amount: byId.get(x.id) ?? 0 }));
}
