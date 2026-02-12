import type { Env } from "../types/env";
import { getResultState, setResultState, getDraft, sumDraft, clearDraft, clearResultState } from "../db/results";
import { listPlayers, getActiveSessionId } from "../db/sessions";
import { computeSettlementMinTransfers } from "../settlement/settle";
import { autoBalanceToZero } from "../settlement/autobalance";
import { formatSigned } from "../utils/format";
import type { BalanceEntry } from "../types/domain";
import { computeSessionPointsFromBalances } from "../leaderboard/points";
import { applyPointsBatch } from "../db/leaderboard";

export async function cmdResultFinalize(env: Env, chatId: string): Promise<string> {
    // Allow finalize even if /endgame wasn't called
    let state = await getResultState(env, chatId);

    if (!state) {
        const activeSessionId = await getActiveSessionId(env, chatId);
        if (activeSessionId === null) return "No active session. Use /newgame first.";

        await setResultState(env, chatId, activeSessionId, "awaiting_submit");
        state = await getResultState(env, chatId);
        if (!state) return "Failed to enter results phase 😵‍💫";
    }

    const sessionId = state.session_id;

    // Guard against double-finalize
    const sess = await env.DB.prepare(`SELECT status FROM sessions WHERE id = ?`)
        .bind(sessionId)
        .first<{ status: string }>();

    if (!sess) return "Session not found.";
    if (sess.status === "ended") return "Session already finalized.";

    const sessionPlayers = await listPlayers(env, sessionId);
    const draft = await getDraft(env, sessionId);
    const net = await sumDraft(env, sessionId);

    const byUserId = new Map(draft.map((r) => [r.user_id, r.delta]));

    // Build balances (raw from draft; missing treated as 0)
    const entries: BalanceEntry[] = [];
    for (const p of sessionPlayers) {
        const name = p.username ? `@${p.username}` : (p.display_name ?? "Unknown");
        const delta = byUserId.get(p.user_id) ?? 0;
        entries.push({ id: p.user_id, name, balance: delta });
    }

    // Auto-balance BEFORE settlement + points (recommended)
    const autoBalanceResult = autoBalanceToZero(entries);
    const adjustedEntries = autoBalanceResult.adjusted;

    // Settlement (min transfers) based on adjusted balances
    const transfers = computeSettlementMinTransfers(adjustedEntries);

    // Leaderboard points based on adjusted balances (so “final truth” drives points)
    const deltas = computeSessionPointsFromBalances(
        adjustedEntries,
        (id) => {
        const p = sessionPlayers.find(sp => sp.user_id === id);
        return { username: p?.username ?? null, displayName: p?.display_name ?? null };
        }
    );

    await applyPointsBatch(
        env,
        chatId,
        sessionId,
        deltas.map(d => ({
        userId: d.userId,
        username: d.username,
        displayName: d.displayName,
        delta: d.deltaPoints,
        reason: d.reason
        }))
    );

    let out = `📌 Finalizing session #${sessionId}\n`;

    out += `\nDraft net (raw): ${formatSigned(net)}\n`;
    if (autoBalanceResult.note) out += `${autoBalanceResult.note}\n`;

    out += `\nResults (raw):\n`;
    for (const p of sessionPlayers) {
        const name = p.username ? `@${p.username}` : (p.display_name ?? "Unknown");
        const delta = byUserId.get(p.user_id);
        out += `- ${name}: ${delta === undefined ? "(not provided)" : formatSigned(delta)}\n`;
    }

    out += `\nSettlement:\n`;
    if (transfers.length === 0) {
        out += `(No transfers needed)\n`;
    } else {
        for (const t of transfers) out += `- ${t.from} pays ${t.to} ${t.amount}\n`;
    }

    out += `\n📈 Leaderboard update:\n`;
    for (const d of deltas) {
        const nm = d.username ? `@${d.username}` : (d.displayName ?? "Unknown");
        out += `- ${nm}: ${formatSigned(d.deltaPoints)}\n`;
    }

    // END THE SESSION HERE (single source of truth)
    await env.DB.prepare(`UPDATE sessions SET status = 'ended' WHERE id = ?`)
        .bind(sessionId)
        .run();

    // Clear temporary data
    await clearDraft(env, sessionId);
    await clearResultState(env, chatId);

    out += `\nSession ended ✅\nDraft cleared ✅`;
    return out.trimEnd();
}
