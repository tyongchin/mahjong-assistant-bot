import type { TgUser } from "../types/telegram";

export function parseCommand(text: string): { command: string } {
  const first = text.split(/\s+/)[0]; // "/join@Bot"
  const withoutSlash = first.startsWith("/") ? first.slice(1) : first;
  const command = withoutSlash.split("@")[0].toLowerCase();
  return { command };
}

export function makeDisplayName(from: TgUser): string {
  const first = from.first_name ?? "";
  const last = from.last_name ?? "";
  const full = `${first} ${last}`.trim();
  return full || from.username || "Unknown";
}
