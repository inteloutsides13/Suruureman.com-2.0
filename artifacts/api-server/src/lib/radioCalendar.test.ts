import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarWeekRange,
  currentCalendarDate,
  RADIO_CALENDAR_TIMEZONE,
  radioCalendarInput,
} from "./radioCalendar.js";

test("calendar accepts only the specified programme fields, types, and Berlin timezone", () => {
  const valid = {
    titleEn: "Poetry Hour",
    titleUr: "شاعری",
    descriptionEn: null,
    descriptionUr: null,
    programmeType: "Poetry Hour",
    programmeDate: "2026-10-12",
    startTime: "18:30",
    endTime: "19:30",
    timezone: "Europe/Berlin",
    externalLink: null,
    publicNote: null,
  };
  assert.equal(radioCalendarInput.safeParse(valid).success, true);
  assert.deepEqual(
    [radioCalendarInput.parse({ ...valid, startTime: "18:30:00", endTime: "19:30:00" }).startTime,
      radioCalendarInput.parse({ ...valid, startTime: "18:30:00", endTime: "19:30:00" }).endTime],
    ["18:30", "19:30"],
  );
  assert.equal(radioCalendarInput.safeParse({ ...valid, timezone: "Asia/Dubai" }).success, false);
  assert.equal(radioCalendarInput.safeParse({ ...valid, programmeType: "Legacy playlist" }).success, false);
  assert.equal(radioCalendarInput.safeParse({ ...valid, programmeDate: "2026-02-30" }).success, false);
  assert.equal(radioCalendarInput.safeParse({ ...valid, unexpectedField: true }).success, false);
  assert.equal(radioCalendarInput.safeParse({ ...valid, endTime: valid.startTime }).success, false);
  assert.equal(radioCalendarInput.safeParse({ ...valid, startTime: "19:30", endTime: "18:30" }).success, false);
});

test("calendar date uses Europe/Berlin across the daylight-saving transition", () => {
  assert.equal(RADIO_CALENDAR_TIMEZONE, "Europe/Berlin");
  assert.equal(currentCalendarDate(new Date("2026-03-28T23:30:00.000Z")), "2026-03-29");
  assert.equal(currentCalendarDate(new Date("2026-03-29T22:30:00.000Z")), "2026-03-30");
});

test("weekly range contains seven date-based days and rejects invalid dates", () => {
  assert.deepEqual(calendarWeekRange("2026-10-12"), { start: "2026-10-12", end: "2026-10-19" });
  assert.equal(calendarWeekRange("2026-02-30"), null);
});
