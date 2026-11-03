import assert from "node:assert/strict";
import test from "node:test";
import {
  acquirePoemDuplicateLock,
  duplicateConflictBody,
  findPoemDuplicate,
  normalizeUrduComparisonText,
  POEM_DUPLICATE_LOCK_KEY,
  type PoemDuplicateInput,
  type PoemDuplicateRecord,
} from "./poemDuplicatePrevention.js";

const poem = (overrides: Partial<PoemDuplicateRecord> = {}): PoemDuplicateRecord => ({
  id: 1,
  titleUrdu: "عنوان",
  poetName: "Poet",
  poetNameUrdu: "شاعر",
  content: "پہلا مصرع\nدوسرا مصرع",
  language: "urdu",
  status: "published",
  createdByUserId: null,
  ...overrides,
});

const input = (overrides: Partial<PoemDuplicateInput> = {}): PoemDuplicateInput => ({
  titleUrdu: "عنوان",
  poetName: "Poet",
  poetNameUrdu: "شاعر",
  content: "پہلا مصرع\nدوسرا مصرع",
  language: "urdu",
  ...overrides,
});

test("matches a normalized Urdu title only when the poet identity also matches", () => {
  assert.equal(findPoemDuplicate(input({ titleUrdu: "  عُنْوان  " }), [poem()])?.reason, "title-and-poet");
  assert.equal(findPoemDuplicate(input({
    poetName: "Different",
    poetNameUrdu: "مختلف",
    content: "distinct content",
  }), [poem()]), null);
});

test("matches normalized full Urdu content even when titles differ", () => {
  assert.equal(findPoemDuplicate(input({
    titleUrdu: "دوسرا عنوان",
    content: "پہلا   مِصْرَع\n\nدوسرا مصرع",
  }), [poem()])?.reason, "content");
});

test("normalizes Unicode and formatting while retaining punctuation and letter distinctions", () => {
  assert.equal(normalizeUrduComparisonText(" کلام\u0640   خوب "), "کلام خوب");
  assert.equal(normalizeUrduComparisonText("ع۔نوان"), "ع۔نوان");
  assert.equal(normalizeUrduComparisonText("کلام،"), "کلام،");
  assert.equal(normalizeUrduComparisonText("کلام"), normalizeUrduComparisonText("کَلام"));
  assert.notEqual(normalizeUrduComparisonText("کلام"), normalizeUrduComparisonText("كلام"));
});

test("does not compare non-Urdu poem content", () => {
  assert.equal(findPoemDuplicate(input({
    language: "english",
    titleUrdu: "دوسرا عنوان",
    poetName: "Another poet",
    poetNameUrdu: "دوسرا شاعر",
  }), [poem({ language: "english" })]), null);
});

test("excludes the edited record and permits unchanged legacy duplicate identities", () => {
  const existing = poem();
  assert.equal(findPoemDuplicate(input(), [existing], { excludeId: existing.id }), null);
  assert.equal(findPoemDuplicate(input(), [existing, poem({ id: 2 })], {
    excludeId: existing.id,
    previous: existing,
  }), null);
  assert.equal(findPoemDuplicate(input({ titleUrdu: "دوسرا عنوان" }), [existing, poem({ id: 2, titleUrdu: "دوسرا عنوان" })], {
    excludeId: existing.id,
    previous: existing,
  })?.reason, "title-and-poet");
});

test("does not reveal details for another contributor's unpublished duplicate", () => {
  const duplicate = findPoemDuplicate(input(), [poem({
    status: "pending",
    createdByUserId: 99,
  })])!;
  assert.deepEqual(duplicateConflictBody(duplicate, { role: "contributor", userId: 7 }), {
    message: "This submission may duplicate an existing poem. Please contact an editor.",
  });
  assert.equal("duplicate" in duplicateConflictBody(duplicate, { role: "contributor", userId: 7 }), false);
  assert.equal("duplicate" in duplicateConflictBody(duplicate, { role: "admin", userId: 1 }), true);
});

test("acquires the PostgreSQL transaction-scoped lock before a write can proceed", async () => {
  const waiting: Array<() => void> = [];
  let locked = false;
  const tx = {
    async execute() {
      if (locked) await new Promise<void>((resolve) => waiting.push(resolve));
      locked = true;
      return {};
    },
  };

  let completed = 0;
  const enter = async () => {
    await acquirePoemDuplicateLock(tx);
    completed += 1;
    locked = false;
    waiting.shift()?.();
  };
  await Promise.all([enter(), enter()]);
  assert.equal(POEM_DUPLICATE_LOCK_KEY, 730114210);
  assert.equal(completed, 2);
});
