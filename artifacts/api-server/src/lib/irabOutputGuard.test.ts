import assert from "node:assert/strict";
import test from "node:test";
import { validateIrabOutput } from "./irabOutputGuard.js";

test("accepts Urdu text when output only adds permitted diacritics", () => {
  const input = "دل غم\nعشق کی شب";
  const output = "دِل غَم\nعِشق کی شَب";

  assert.deepEqual(validateIrabOutput(input, output), { ok: true, text: output });
});

test("preserves ZWNJ and ordinary Unicode characters", () => {
  const input = "می\u200cرا دل";
  const output = "مِی\u200cرا دِل";

  assert.equal(validateIrabOutput(input, output).ok, true);
});

test("preserves Unicode line separators and rejects merged lines", () => {
  const input = "پہلا مصرع\nدوسرا مصرع";

  assert.equal(validateIrabOutput(input, "پہلا مِصرع دوسرا مِصرع").ok, false);
  assert.equal(validateIrabOutput(input, "پہلا مِصرع\nدوسرا مِصرع").ok, true);
});

test("rejects empty and whitespace-only provider output", () => {
  assert.equal(validateIrabOutput("دل", "").ok, false);
  assert.equal(validateIrabOutput("دل", "   ").ok, false);
});

test("rejects Markdown and explanatory wrappers", () => {
  assert.equal(validateIrabOutput("دل", "```urdu\nدل\n```").ok, false);
  assert.equal(validateIrabOutput("دل", "Here is the diacritized text:\nدل").ok, false);
  assert.equal(validateIrabOutput("دل", "اعراب شدہ متن: دل").ok, false);
});

test("rejects changed words, punctuation, and line count", () => {
  assert.equal(validateIrabOutput("دل", "غم").ok, false);
  assert.equal(validateIrabOutput("دل۔", "دِل").ok, false);
  assert.equal(validateIrabOutput("ایک\nدو", "اَیک دو").ok, false);
});