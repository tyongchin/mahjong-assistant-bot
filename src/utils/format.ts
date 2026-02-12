import type { Player } from "../types/domain";

export function formatSigned(x: number): string {
  return x >= 0 ? `+${x}` : `${x}`;
}

export function formatName(p: Player): string {
  return p.username ? `@${p.username}` : (p.display_name ?? "Unknown");
}
