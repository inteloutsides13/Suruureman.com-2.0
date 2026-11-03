const PERMITTED_DIACRITICS = /[\u064B-\u0655\u0670]/gu;

const EXPLANATORY_PREFIX =
  /^(?:here\s+is(?:\s+the)?\s+(?:diacritized|corrected)\s+text|the\s+(?:diacritized|corrected)\s+text|explanation|note)\s*[:：-]/iu;
const URDU_EXPLANATORY_PREFIX =
  /^(?:اعراب\s*شدہ\s*متن|اعراب\s*یافتہ\s*متن|تشریح|وضاحت|نوٹ)\s*[:：-]/u;
const LINE_BREAK = /\r\n|\n|\r|\u2028|\u2029|\u0085/g;

export type IrabOutputGuardResult =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" | "markdown" | "wrapper" | "line-structure" | "text-changed" };

function removePermittedDiacritics(value: string): string {
  return value.replace(PERMITTED_DIACRITICS, "");
}

function splitPreservingLineBreaks(value: string): { lines: string[]; breaks: string[] } {
  const lines: string[] = [];
  const breaks: string[] = [];
  let cursor = 0;

  for (const match of value.matchAll(LINE_BREAK)) {
    const index = match.index ?? cursor;
    lines.push(value.slice(cursor, index));
    breaks.push(match[0]);
    cursor = index + match[0].length;
  }

  lines.push(value.slice(cursor));
  return { lines, breaks };
}

/**
 * Accepts only input text plus additions from the explicitly permitted
 * Arabic/Urdu diacritic set. All other characters and line separators must
 * remain byte-for-byte identical.
 */
export function validateIrabOutput(input: string, output: string): IrabOutputGuardResult {
  if (output.length === 0 || output.trim().length === 0) {
    return { ok: false, reason: "empty" };
  }

  if (output.includes("```")) {
    return { ok: false, reason: "markdown" };
  }

  if (EXPLANATORY_PREFIX.test(output) || URDU_EXPLANATORY_PREFIX.test(output)) {
    return { ok: false, reason: "wrapper" };
  }

  const inputStructure = splitPreservingLineBreaks(input);
  const outputStructure = splitPreservingLineBreaks(output);

  if (
    inputStructure.lines.length !== outputStructure.lines.length ||
    inputStructure.breaks.length !== outputStructure.breaks.length ||
    inputStructure.breaks.some((lineBreak, index) => lineBreak !== outputStructure.breaks[index])
  ) {
    return { ok: false, reason: "line-structure" };
  }

  const inputWithoutDiacritics = inputStructure.lines.map(removePermittedDiacritics);
  const outputWithoutDiacritics = outputStructure.lines.map(removePermittedDiacritics);

  if (
    inputWithoutDiacritics.length !== outputWithoutDiacritics.length ||
    inputWithoutDiacritics.some((line, index) => line !== outputWithoutDiacritics[index])
  ) {
    return { ok: false, reason: "text-changed" };
  }

  return { ok: true, text: output };
}