export function formatSigned(x: number): string {
    return x >= 0 ? `+${x}` : `${x}`;
}

type NameLike = {
  username: string | null;
  display_name: string | null;
};
export function formatName(p: NameLike): string {
  return p.display_name ?? (p.username ? p.username : "Unknown");
}
