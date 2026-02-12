import type { Env } from "../types/env";
import { getResultState, getDraft, sumDraft, clearDraft, clearResultState } from "../db/results";
import { listPlayers } from "../db/sessions";
import { computeSettlementMinTransfers } from "../settlement/settle";
import { formatSigned } from "../utils/format";
import type { BalanceEntry } from "../types/domain";
import { autoBalanceToZero } from "../settlement/autobalance";

export async function cmdResultFinalize(env: Env, chatId: string): Promise<string> {
  const state = await getResultState(env, chatId);
  if (!state) return "No ended session is awaiting finalize. Use /endgame first.";

  const sessionId = state.session_id;

  const sessionPlayers = await listPlayers(env, sessionId);
  const draft = await getDraft(env, sessionId);
  const net = await sumDraft(env, sessionId);

  // Map draft by user_id
  const byUserId = new Map(draft.map((r) => [r.user_id, r.delta]));

  // Build balance entries only for players in session
  const entries: BalanceEntry[] = [];
  for (const p of sessionPlayers) {
    const name = p.username ? `@${p.username}` : (p.display_name ?? "Unknown");
    const delta = byUserId.get(p.user_id) ?? 0; // not provided -> treat as 0 in settlement
    entries.push({ id: p.user_id, name, balance: delta });
  }

  // Auto-balance to zero
  const autoBalanceResult = autoBalanceToZero(entries);
  const adjustedEntries = autoBalanceResult.adjusted;

  // Settlement (min transfers)
  const transfers = computeSettlementMinTransfers(adjustedEntries);

  let out = `📌 Finalizing session #${sessionId}\n`;
  out += `\nResults:\n`;
  for (const p of sessionPlayers) {
    const name = p.username ? `@${p.username}` : (p.display_name ?? "Unknown");
    const delta = byUserId.get(p.user_id);
    out += `- ${name}: ${delta === undefined ? "(not provided)" : formatSigned(delta)}\n`;
  }

  out += `\nSettlement:\n`;
  if (transfers.length === 0) {
    out += `(No transfers needed)\n`;
  } else {
    for (const t of transfers) {
      out += `- ${t.from} pays ${t.to} ${t.amount}\n`;
    }
  }

  // Clear temporary data (as requested)
  await clearDraft(env, sessionId);
  await clearResultState(env, chatId);

  out += `\nDraft cleared ✅`;
  return out.trimEnd();
}
