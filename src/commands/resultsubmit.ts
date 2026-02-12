import type { Env } from "../types/env";
import type { Player } from "../types/domain";
import { getResultState, setResultState, clearDraft, writeDraft, sumDraft } from "../db/results";
import { listPlayers, getActiveSessionId } from "../db/sessions";
import { getUserIdByUsername } from "../db/players";
import { formatName, formatSigned } from "../utils/format";
import { parseSubmit } from "../utils/parse";

export async function cmdResultSubmit(env: Env, chatId: string, rawText: string): Promise<string> {
    // Allow /resultsubmit even if /endgame wasn't called.
    // If there is no result_state, bind it to the current active session.
    let state = await getResultState(env, chatId);

    if (!state) {
        const activeSessionId = await getActiveSessionId(env, chatId);
        if (activeSessionId === null) {
        return "No active session. Use /newgame first.";
        }

        await setResultState(env, chatId, activeSessionId, "awaiting_submit");
        state = await getResultState(env, chatId);
        if (!state) return "Failed to enter results phase 😵‍💫";
    }

    const sessionId = state.session_id;

    const sessionPlayers = await listPlayers(env, sessionId);
    if (sessionPlayers.length === 0) {
        return "This session has no players.";
    }

    const parsed = parseSubmit(rawText);
    if (parsed.length === 0) {
        return (
        "Usage:\n" +
        "/resultsubmit\n" +
        "alice 12\n" +
        "bob -8\n" +
        "charlie -4\n" +
        "david 0"
        );
    }

    const expectedUserIds = new Set(sessionPlayers.map((p) => p.user_id));

    const rowsToInsert: Array<{ userId: string; delta: number }> = [];
    const notInSession: string[] = [];
    const unknownUsers: string[] = [];

    for (const line of parsed) {
        const userId = await getUserIdByUsername(env, line.username);
        if (!userId) {
            const p: Player = { user_id: "", username: line.username, display_name: null };
            unknownUsers.push(formatName(p));
            continue;
        }
        if (!expectedUserIds.has(userId)) {
            const p: Player = { user_id: userId, username: line.username, display_name: null };
            notInSession.push(formatName(p));
            continue;
        }
        rowsToInsert.push({ userId, delta: line.delta });
    }

    // Overwrite draft on every submit (resubmission-friendly)
    await clearDraft(env, sessionId);
    await writeDraft(env, sessionId, rowsToInsert);

    const net = await sumDraft(env, sessionId);

    const provided = new Set(rowsToInsert.map((r) => r.userId));
    const missing = sessionPlayers
        .filter((p) => !provided.has(p.user_id))
        .map((p) => formatName(p));

    let out = `✅ Draft results saved for session #${sessionId}.\n`;

    if (unknownUsers.length > 0) {
        out += `\nUnrecognized usernames (bot hasn't learned them yet):\n- ${unknownUsers.join("\n- ")}`;
    }
    if (notInSession.length > 0) {
        out += `\nThese users are not in this session:\n- ${notInSession.join("\n- ")}`;
    }
    if (missing.length > 0) {
        out += `\nMissing players (not provided in your submission):\n- ${missing.join("\n- ")}`;
    }

    if (net !== 0) {
        out += `\n⚠️ Totals don’t sum to 0. Net = ${formatSigned(net)}.\n`;
        if (net > 0) out += `You have ${formatSigned(net)} extra (someone needs to lose ${net}).\n`;
        else out += `You are missing +${Math.abs(net)} (someone needs to win ${Math.abs(net)}).\n`;

        out += `Resubmit /resultsubmit to correct, or call /resultfinalize to finalize anyway.`;
    } else {
        out += `\n\n✅ Totals sum to 0.\n`;
        out += `You can resubmit /resultsubmit if you want to correct anything.\n`;
        out += `When ready, call /resultfinalize.`;
    }

    return out.trimEnd();
}
