// Fisher–Yates shuffle
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomInt(min: number, max: number): number {
  const range = max - min + 1;
  const x = crypto.getRandomValues(new Uint32Array(1))[0];
  return min + (x % range);
}
