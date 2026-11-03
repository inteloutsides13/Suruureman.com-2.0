const ARABIC_SCRIPT_LETTER = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u;

export function getFirstFourUrduLines(content: string): string[] | null {
  const lines = content.split(/\r\n|\n/).filter((line) => {
    return line.trim().length > 0 && [...line].some((character) =>
      /\p{L}/u.test(character) && ARABIC_SCRIPT_LETTER.test(character),
    );
  });

  return lines.length >= 4 ? lines.slice(0, 4) : null;
}

export function getUtcDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function getDailyPoemStartIndex(dayKey: string, poemCount: number): number {
  if (poemCount <= 0) return 0;

  // FNV-1a provides a stable daily pseudo-random offset across processes/restarts.
  let hash = 0x811c9dc5;
  for (const character of dayKey) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % poemCount;
}
