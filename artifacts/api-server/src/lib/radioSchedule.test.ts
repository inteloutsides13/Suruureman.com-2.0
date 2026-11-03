import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_RADIO_TIMEZONE,
  findScheduleOccurrence,
  scheduleValidationError,
} from "./radioSchedule.js";

test("radio programme schedules default to Dubai time", () => {
  assert.equal(DEFAULT_RADIO_TIMEZONE, "Asia/Dubai");
});

test("weekly schedules that cross midnight remain current on the following Dubai date", () => {
  const occurrence = findScheduleOccurrence({
    timezone: "Asia/Dubai",
    daysOfWeek: [0],
    startLocalTime: "23:00",
    endLocalTime: "02:00",
  }, new Date("2026-10-11T20:30:00.000Z"));

  assert.ok(occurrence);
  assert.equal(occurrence.state, "current");
  assert.equal(occurrence.localDate, "2026-10-11");
  assert.equal(occurrence.startsAt.toISOString(), "2026-10-11T19:00:00.000Z");
  assert.equal(occurrence.endsAt.toISOString(), "2026-10-11T22:00:00.000Z");
});

test("schedule validation accepts overnight times but rejects identical boundaries", () => {
  const base = {
    timezone: "Asia/Dubai",
    daysOfWeek: [1],
    startLocalTime: "23:30",
    endLocalTime: "01:00",
  };
  assert.equal(scheduleValidationError(base), null);
  assert.match(scheduleValidationError({ ...base, endLocalTime: "23:30" }) ?? "", /different/);
});
