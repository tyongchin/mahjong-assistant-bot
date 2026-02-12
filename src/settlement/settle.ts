import type { BalanceEntry, Transfer } from "../types/domain";

/**
 * Computes settlement transfers.
 * - Minimizes number of transfers for up to ~16 non-zero participants (optimal).
 * - Falls back to greedy for larger groups.
 */
export function computeSettlementMinTransfers(entries: BalanceEntry[]): Transfer[] {
  // Remove zeros
  const nz = entries.filter(e => e.balance !== 0);

  if (nz.length === 0) return [];

  // Must sum to 0 for perfect settlement
  const total = nz.reduce((s, e) => s + e.balance, 0);
  if (total !== 0) {
    // Add a virtual adjustment so we can still compute transfers.
    // If total > 0: too much winnings -> someone missing a loss of total
    // If total < 0: too much loss -> someone missing a win of -total
    const adj: BalanceEntry =
      total > 0
        ? { id: "__adj__", name: "ADJUSTMENT (missing loser)", balance: -total }
        : { id: "__adj__", name: "ADJUSTMENT (missing winner)", balance: -total };

    nz.push(adj);
  }

  // If small enough, do optimal partition into max zero-sum groups
  if (nz.length <= 16) {
    return settleOptimalByZeroSumPartition(nz);
  }

  // Otherwise, greedy global (fast)
  return settleGreedy(nz);
}

/** Greedy “min cash flow” settlement: correct, fast, usually near-min transfers. */
function settleGreedy(entries: BalanceEntry[]): Transfer[] {
  const debtors = entries
    .filter(e => e.balance < 0)
    .map(e => ({ ...e, balance: -e.balance })) // store as positive debt amount
    .sort((a, b) => b.balance - a.balance);

  const creditors = entries
    .filter(e => e.balance > 0)
    .map(e => ({ ...e }))
    .sort((a, b) => b.balance - a.balance);

  const transfers: Transfer[] = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const pay = debtors[i];
    const recv = creditors[j];

    const amt = Math.min(pay.balance, recv.balance);
    if (amt > 0) {
      transfers.push({ from: pay.name, to: recv.name, amount: amt });
      pay.balance -= amt;
      recv.balance -= amt;
    }

    if (pay.balance === 0) i++;
    if (recv.balance === 0) j++;
  }

  return transfers;
}

/**
 * Optimal min-transfer settlement:
 * 1) Partition into maximum number of disjoint zero-sum subsets (DP).
 * 2) Within each subset, greedy settle uses (k-1) transfers (optimal within group).
 */
function settleOptimalByZeroSumPartition(entries: BalanceEntry[]): Transfer[] {
  const m = entries.length;
  const balances = entries.map(e => e.balance);

  const allMask = (1 << m) - 1;

  // Precompute sum[mask]
  const sum = new Array<number>(1 << m).fill(0);
  for (let mask = 1; mask <= allMask; mask++) {
    const lsb = mask & -mask;
    const i = bitIndex(lsb);
    const prev = mask ^ lsb;
    sum[mask] = sum[prev] + balances[i];
  }

  // dp[mask] = max number of disjoint zero-sum subsets inside mask
  const dp = new Array<number>(1 << m).fill(-1);
  const choice = new Array<number>(1 << m).fill(0); // store chosen zero-subset
  dp[0] = 0;

  for (let mask = 1; mask <= allMask; mask++) {
    // Option: don't take any subset now; inherit best from a submask by removing one bit
    const lsb = mask & -mask;
    const prev = mask ^ lsb;
    dp[mask] = dp[prev];
    choice[mask] = 0;

    // If mask itself sums to 0, it's a candidate subset (one group)
    // But we want maximum number of groups, so we try picking any zero-sum submask.
    // Enumerate submasks that include lsb to avoid duplicates
    // sub = mask; sub = (sub-1) & mask iterates all submasks
    for (let sub = mask; sub; sub = (sub - 1) & mask) {
      if ((sub & lsb) === 0) continue; // enforce lsb included
      if (sum[sub] !== 0) continue;

      const rest = mask ^ sub;
      const cand = dp[rest] + 1;
      if (cand > dp[mask]) {
        dp[mask] = cand;
        choice[mask] = sub;
      }
    }
  }

  // Recover partition: list of zero-sum groups (submasks)
  const groups: number[] = [];
  let cur = allMask;
  while (cur) {
    const sub = choice[cur];
    if (sub) {
      groups.push(sub);
      cur = cur ^ sub;
    } else {
      // no group chosen; drop one bit
      cur = cur ^ (cur & -cur);
    }
  }

  // For any leftover elements not in groups (shouldn't happen if total sums to 0),
  // just settle them greedily in one group.
  const groupedMask = groups.reduce((a, g) => a | g, 0);
  const leftover = allMask ^ groupedMask;
  if (leftover !== 0) groups.push(leftover);

  // Settle each group individually (each group sums to 0 or is leftover)
  const transfers: Transfer[] = [];
  for (const g of groups) {
    const groupEntries: BalanceEntry[] = [];
    for (let i = 0; i < m; i++) {
      if (g & (1 << i)) groupEntries.push(entries[i]);
    }
    // If group sum isn't 0 (leftover), greedy still produces something.
    transfers.push(...settleGreedy(groupEntries));
  }

  return transfers;
}

function bitIndex(bit: number): number {
  // bit is power of two
  let idx = 0;
  while ((bit >> idx) !== 1) idx++;
  return idx;
}
