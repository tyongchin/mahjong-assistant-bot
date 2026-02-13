import type { Env } from "../types/env";
import type { BalanceEntry } from "../types/domain";
import { getResultState, setResultState, getDraft, sumDraft, clearDraft, clearResultState } from "../db/results";
import { listPlayers, getActiveSessionId } from "../db/sessions";
import { computeSettlementMinTransfers } from "../settlement/settle";
import { autoBalanceToZero } from "../settlement/autobalance";
import { formatName, formatSigned } from "../utils/format";
import { computeSessionPointsFromBalances } from "../leaderboard/points";
import { applyPointsBatch } from "../db/leaderboard";

export async function cmdFinalize(env: Env, chatId: string): Promise<string> {
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
        const name = formatName(p);
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
            return { username: p?.username ?? null, display_name: p?.display_name ?? null };
        }
    );

    await applyPointsBatch(
        env,
        chatId,
        sessionId,
        deltas.map(d => ({
        user_id: d.user_id,
        username: d.username,
        display_name: d.display_name,
        delta: d.delta_points,
        reason: d.reason
        }))
    );

    let out = `📌 Finalizing session #${sessionId}`;

    out += `\n\nResults:\n`;
    for (const p of sessionPlayers) {
        const name = formatName(p);
        const delta = byUserId.get(p.user_id);
        out += `- ${name}: ${delta === undefined ? "(not provided)" : formatSigned(delta)}\n`;
    }

    out += `\n\nSettlement:\n`;
    if (transfers.length === 0) {
        out += `(No transfers needed)\n`;
    } 
    else {
        for (const t of transfers) out += `- ${t.from} pays ${t.to} ${t.amount}\n`;
    }

    out += `\n\n📈 Leaderboard update:\n`;
    for (const d of deltas) {
        const nm = formatName(d);
        out += `- ${nm}: ${formatSigned(d.delta_points)}\n`;
    }

    // END THE SESSION HERE (single source of truth)
    await env.DB.prepare(`UPDATE sessions SET status = 'ended' WHERE id = ?`)
        .bind(sessionId)
        .run();

    // Clear temporary data
    await clearDraft(env, sessionId);
    await clearResultState(env, chatId);

    return out.trimEnd();
}
