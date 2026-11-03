import { sql, type SQL } from "drizzle-orm";
import { poemsTable } from "@workspace/db/schema";

export const POEM_DUPLICATE_LOCK_KEY = 730114210;

const URDU_DIACRITICS = /[\u064b-\u065f\u0670]/gu;
const FORMATTING_CHARACTERS = /[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/gu;

/**
 * Conservative comparison key only; this value is never persisted.
 * NFKC and whitespace folding cover compatibility/formatting differences.
 * Urdu tashkeel and tatweel are ignored; punctuation and letter choices remain significant.
 */
export function normalizeUrduComparisonText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(FORMATTING_CHARACTERS, "")
    .replace(URDU_DIACRITICS, "")
    .replace(/\u0640/gu, "")
    .replace(/[\s\p{Z}]+/gu, " ")
    .trim();
}

export interface PoemDuplicateRecord {
  id: number;
  titleUrdu: string;
  poetName: string;
  poetNameUrdu: string;
  content: string;
  language: string;
  status: string;
  createdByUserId: number | null;
}

export interface PoemDuplicateInput {
  titleUrdu: string;
  poetName: string;
  poetNameUrdu: string;
  content: string;
  language: string;
}

export interface PoemDuplicateMatch extends Pick<
  PoemDuplicateRecord,
  "id" | "titleUrdu" | "poetNameUrdu" | "status" | "createdByUserId"
> {
  reason: "title-and-poet" | "content";
}

function samePoet(left: PoemDuplicateInput, right: PoemDuplicateRecord): boolean {
  const leftUrdu = normalizeUrduComparisonText(left.poetNameUrdu);
  const rightUrdu = normalizeUrduComparisonText(right.poetNameUrdu);
  const leftEnglish = normalizeUrduComparisonText(left.poetName).toLocaleLowerCase("en");
  const rightEnglish = normalizeUrduComparisonText(right.poetName).toLocaleLowerCase("en");

  return (leftUrdu.length > 0 && leftUrdu === rightUrdu)
    || (leftEnglish.length > 0 && leftEnglish === rightEnglish);
}

function samePoemLanguage(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase("en") === right.trim().toLocaleLowerCase("en");
}

export function findPoemDuplicate(
  candidate: PoemDuplicateInput,
  existing: readonly PoemDuplicateRecord[],
  options: { excludeId?: number; previous?: PoemDuplicateRecord } = {},
): PoemDuplicateMatch | null {
  const titleKey = normalizeUrduComparisonText(candidate.titleUrdu);
  const contentKey = normalizeUrduComparisonText(candidate.content);
  const titleWasUnchanged = Boolean(options.previous)
    && titleKey === normalizeUrduComparisonText(options.previous!.titleUrdu)
    && samePoet(candidate, options.previous!);
  const contentWasUnchanged = Boolean(options.previous)
    && samePoemLanguage(candidate.language, options.previous!.language)
    && contentKey === normalizeUrduComparisonText(options.previous!.content);

  for (const poem of existing) {
    if (poem.id === options.excludeId) continue;

    if (
      !titleWasUnchanged
      && titleKey.length > 0
      && titleKey === normalizeUrduComparisonText(poem.titleUrdu)
      && samePoet(candidate, poem)
    ) {
      return {
        id: poem.id,
        titleUrdu: poem.titleUrdu,
        poetNameUrdu: poem.poetNameUrdu,
        status: poem.status,
        createdByUserId: poem.createdByUserId,
        reason: "title-and-poet",
      };
    }

    if (
      !contentWasUnchanged
      && samePoemLanguage(candidate.language, "urdu")
      && samePoemLanguage(poem.language, "urdu")
      && contentKey.length > 0
      && contentKey === normalizeUrduComparisonText(poem.content)
    ) {
      return {
        id: poem.id,
        titleUrdu: poem.titleUrdu,
        poetNameUrdu: poem.poetNameUrdu,
        status: poem.status,
        createdByUserId: poem.createdByUserId,
        reason: "content",
      };
    }
  }
  return null;
}

export async function findPoemDuplicateInTransaction(
  tx: any,
  candidate: PoemDuplicateInput,
  options: { excludeId?: number; previous?: PoemDuplicateRecord } = {},
): Promise<PoemDuplicateMatch | null> {
  const existing = await tx.select({
    id: poemsTable.id,
    titleUrdu: poemsTable.titleUrdu,
    poetName: poemsTable.poetName,
    poetNameUrdu: poemsTable.poetNameUrdu,
    content: poemsTable.content,
    language: poemsTable.language,
    status: poemsTable.status,
    createdByUserId: poemsTable.createdByUserId,
  }).from(poemsTable);
  return findPoemDuplicate(candidate, existing, options);
}

export type PoemLockTransaction = {
  execute(query: SQL): Promise<unknown>;
};

/** Must be called inside the transaction that will check and write the poem. */
export async function acquirePoemDuplicateLock(tx: PoemLockTransaction): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${POEM_DUPLICATE_LOCK_KEY})`);
}

export function duplicateConflictBody(
  duplicate: PoemDuplicateMatch,
  actor: { role: "admin" | "developer" | "contributor"; userId: number },
) {
  const reason = duplicate.reason === "content"
    ? "The poem content matches an existing Urdu poem."
    : "A poem with this Urdu title by the same poet already exists.";
  const canSeeDetails = actor.role !== "contributor"
    || duplicate.status === "published"
    || duplicate.createdByUserId === actor.userId;

  return {
    message: canSeeDetails
      ? `${reason} Review the existing poem before submitting.`
      : "This submission may duplicate an existing poem. Please contact an editor.",
    ...(canSeeDetails ? {
      duplicate: {
        id: duplicate.id,
        titleUrdu: duplicate.titleUrdu,
        poetNameUrdu: duplicate.poetNameUrdu,
      },
    } : {}),
  };
}
