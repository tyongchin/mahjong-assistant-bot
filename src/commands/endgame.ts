import type { Env } from "../types/env";
import type { Player } from "../types/domain";
import { getActiveSessionId, listPlayers } from "../db/sessions";
import { getResultState, setResultState, clearDraft, writeDraft, sumDraft } from "../db/results";
import { getUserIdByUsername } from "../db/players";
import { formatName, formatSigned } from "../utils/format";
import { parseSubmit } from "../utils/parse";

/**
 * /endgame
 * - No params: prints results template (old /endgame)
 * - With params: submits draft results (old /resultsubmit)
 */
export async function cmdEndGame(
    env: Env,
    chatId: string,
    rawText: string
): Promise<string[] | string> {
    const trimmed = rawText.trim();
    const lines = trimmed.split(/\r?\n/);

    // Mode A: /endgame (template)
    // Treat "just the command on one line" as template mode.
    const templateMode = lines.length <= 1;

    if (templateMode) {
        const sessionId = await getActiveSessionId(env, chatId);
        if (sessionId === null) return ["No active session. 😭 Use /newgame."];

        const players = await listPlayers(env, sessionId);
        if (players.length === 0) {
        return [`Session #${sessionId} has no players.`];
        }

        const message =
        `Session #${sessionId} results template 🧾\n\n` +
        `Rules:\n` +
        `- Integers only\n` +
        `- You can resubmit /endgame anytime\n` +
        `- Call /finalize when ready\n\n` +
        `Copy and fill the command below:`;

        const command =
        `/endgame\n` +
        players
            .map((p) => {
            const name = p.username ? `${p.username}` : p.display_name ?? "Unknown";
            return `${name} 0`;
            })
            .join("\n");

        return [message, command];
    }

    // Mode B: /endgame + results (submit)
    // Allow /endgame submission even if template wasn’t called.
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

    // If they *did* include extra lines but parse still fails, show usage.
    if (parsed.length === 0) {
        return (
        "Usage:\n" +
        "/endgame\n" +
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
        out += `\nUnrecognized usernames (bot hasn't learned them yet):\n- ${unknownUsers.join(
        "\n- "
        )}`;
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

        out += `Resubmit /endgame to correct, or call /finalize to finalize anyway.`;
    } else {
        out += `\n\n✅ Totals sum to 0.\n`;
        out += `You can resubmit /endgame if you want to correct anything.\n`;
        out += `When ready, call /finalize.`;
    }

    return out.trimEnd();
}
