import type { TgUser } from "../types/telegram";

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

export function makeDisplayName(from: TgUser): string {
  const first = from.first_name ?? "";
  const last = from.last_name ?? "";
  const full = `${first} ${last}`.trim();
  return full || from.username || "Unknown";
}
