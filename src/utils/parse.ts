import type { TgUser } from "../types/telegram";
import type { ParsedLine } from "../types/domain";
import { normalizeUsername } from "../db/players";

export function parseCommand(text: string): { command: string } {
    const first = text.split(/\s+/)[0]; // "/join@Bot"
    const withoutSlash = first.startsWith("/") ? first.slice(1) : first;
    const command = withoutSlash.split("@")[0].toLowerCase();
    return { command };
}

export function parseSingleUsernameArg(rawText: string): string | null {
    // rawText example: "/add @bob" or "/add bob"
    const parts = rawText.trim().split(/\s+/);
    if (parts.length < 2) return null;
    return parts[1];
}

export function parseTitle(rawText: string): string | null {
    const parts = rawText.trim().split(/\s+/);
    if (parts.length <= 1) return null;

    // Remove "/newgame" (first word) and join the rest
    return rawText.trim().substring(rawText.indexOf(" ") + 1).trim();
}

export function makeDisplayName(from: TgUser): string {
    const first = from.first_name ?? "";
    const last = from.last_name ?? "";
    const full = `${first} ${last}`.trim();
    return full || from.username || "Unknown";
}

export function parseSubmit(rawText: string): ParsedLine[] {
    const lines = rawText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

    if (lines.length === 0) return [];

    const head = lines[0].split(/\s+/)[0];
    if (!head.startsWith("/resultsubmit")) return [];

    const out: ParsedLine[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        // Accept:
        //   tim 5
        //   @tim -3
        // Username token is 1+ chars (letters/digits/_), delta is integer (+ optional)
        const m = line.match(/^@?([A-Za-z0-9_]{1,})\s+([+-]?\d+)$/);
        if (!m) continue;

        const username = normalizeUsername(m[1]); // strips/normalizes case etc
        const delta = parseInt(m[2], 10);
        out.push({ username, delta });
    }

    return out;
}