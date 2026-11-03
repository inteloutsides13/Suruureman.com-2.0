import assert from "node:assert/strict";
import test from "node:test";
import { getDailyPoemStartIndex, getFirstFourUrduLines, getUtcDayKey } from "./dailyPoem.js";

test("extracts the first four non-empty Urdu verse lines without changing their text", () => {
  const content = "  پہلا مصرع،\nدوسرا مصرع!\n\nتیسرا مصرع؟\nچوتھا مصرع۔\nپانچواں مصرع";
  assert.deepEqual(getFirstFourUrduLines(content), [
    "  پہلا مصرع،",
    "دوسرا مصرع!",
    "تیسرا مصرع؟",
    "چوتھا مصرع۔",
  ]);
});

test("ignores non-Urdu lines and rejects poems with fewer than four Urdu verse lines", () => {
  assert.equal(getFirstFourUrduLines("Title\nپہلا\nدوسرا\nتیسرا\n"), null);
  assert.deepEqual(getFirstFourUrduLines("Title\nپہلا\nدوسرا\nتیسرا\nچوتھا"), [
    "پہلا",
    "دوسرا",
    "تیسرا",
    "چوتھا",
  ]);
});

test("daily selection is stable for a date and changes when the UTC day changes", () => {
  const today = getDailyPoemStartIndex("2026-10-16", 1000);
  assert.equal(getDailyPoemStartIndex("2026-10-16", 1000), today);
  assert.notEqual(getDailyPoemStartIndex("2026-10-17", 1000), today);
  assert.equal(getDailyPoemStartIndex("2026-10-16", 0), 0);
});

test("daily boundaries are calculated in UTC", () => {
  assert.equal(getUtcDayKey(new Date("2026-10-16T23:59:59.000Z")), "2026-10-16");
  assert.equal(getUtcDayKey(new Date("2026-10-17T00:00:00.000Z")), "2026-10-17");
});
