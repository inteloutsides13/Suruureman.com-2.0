import { describe, expect, it } from "vitest";
import {
  DEFAULT_RADIO_TIMEZONE,
  findScheduleOccurrence,
  scheduleValidationError,
} from "../../../../artifacts/api-server/src/lib/radioSchedule";

const baseSchedule = {
  timezone: "Europe/Berlin",
  daysOfWeek: [1],
  startLocalTime: "18:00",
  endLocalTime: "19:00",
};

describe("Radio schedule correctness", () => {
  it("uses Europe/Berlin as the canonical application default", () => {
    expect(DEFAULT_RADIO_TIMEZONE).toBe("Europe/Berlin");
    expect(DEFAULT_RADIO_TIMEZONE).not.toBe("Asia/Dubai");
  });

  it("uses Sunday-zero weekday values and returns the current occurrence", () => {
    const occurrence = findScheduleOccurrence(
      { ...baseSchedule, daysOfWeek: [1] },
      new Date("2026-09-14T16:30:00.000Z"),
    );

    expect(occurrence?.state).toBe("current");
    expect(occurrence?.localDate).toBe("2026-09-14");
    expect(occurrence?.startsAt.toISOString()).toBe("2026-09-14T16:00:00.000Z");
    expect(occurrence?.endsAt.toISOString()).toBe("2026-09-14T17:00:00.000Z");
  });

  it("returns an upcoming same-day occurrence and skips the wrong weekday", () => {
    const occurrence = findScheduleOccurrence(
      { ...baseSchedule, daysOfWeek: [2] },
      new Date("2026-09-14T15:00:00.000Z"),
    );

    expect(occurrence?.state).toBe("upcoming");
    expect(occurrence?.localDate).toBe("2026-09-15");
    expect(findScheduleOccurrence(
      { ...baseSchedule, daysOfWeek: [0] },
      new Date("2026-09-14T15:00:00.000Z"),
    )?.localDate).toBe("2026-09-20");
  });

  it("honors inclusive start and exclusive end boundaries", () => {
    const schedule = { ...baseSchedule, daysOfWeek: [1] };
    expect(findScheduleOccurrence(schedule, new Date("2026-09-14T16:00:00.000Z"))?.state).toBe("current");
    expect(findScheduleOccurrence(schedule, new Date("2026-09-14T17:00:00.000Z"))?.localDate).toBe("2026-09-21");
  });

  it("filters expired and not-yet-effective windows", () => {
    const now = new Date("2026-09-14T16:30:00.000Z");
    expect(findScheduleOccurrence({
      ...baseSchedule,
      effectiveUntil: "2026-09-14T15:00:00.000Z",
    }, now)).toBeNull();
    expect(findScheduleOccurrence({
      ...baseSchedule,
      effectiveFrom: "2026-09-22T00:00:00.000Z",
    }, now)).toBeNull();
  });

  it("converts the same local schedule correctly across timezones", () => {
    const occurrence = findScheduleOccurrence({
      ...baseSchedule,
      timezone: "Asia/Dubai",
      daysOfWeek: [1],
      startLocalTime: "20:00",
      endLocalTime: "21:00",
    }, new Date("2026-09-14T15:00:00.000Z"));

    expect(occurrence?.startsAt.toISOString()).toBe("2026-09-14T16:00:00.000Z");
  });

  it("preserves Berlin local time through the spring DST transition", () => {
    const occurrence = findScheduleOccurrence({
      ...baseSchedule,
      daysOfWeek: [0],
      startLocalTime: "03:30",
      endLocalTime: "04:30",
    }, new Date("2026-03-28T12:00:00.000Z"));

    expect(occurrence?.localDate).toBe("2026-03-29");
    expect(occurrence?.startsAt.toISOString()).toBe("2026-03-29T01:30:00.000Z");
    expect(occurrence?.endsAt.toISOString()).toBe("2026-03-29T02:30:00.000Z");
  });

  it("preserves Berlin local time through the autumn DST transition", () => {
    const occurrence = findScheduleOccurrence({
      ...baseSchedule,
      daysOfWeek: [0],
      startLocalTime: "04:30",
      endLocalTime: "05:30",
    }, new Date("2026-10-24T12:00:00.000Z"));

    expect(occurrence?.localDate).toBe("2026-10-25");
    expect(occurrence?.startsAt.toISOString()).toBe("2026-10-25T03:30:00.000Z");
    expect(occurrence?.endsAt.toISOString()).toBe("2026-10-25T04:30:00.000Z");
  });

  it("rejects invalid times, equal times, overnight ranges, and malformed days", () => {
    expect(scheduleValidationError({
      ...baseSchedule,
      startLocalTime: "19:00",
      endLocalTime: "18:00",
    })).toContain("overnight schedules are not supported");
    expect(scheduleValidationError({
      ...baseSchedule,
      startLocalTime: "18:00",
      endLocalTime: "18:00",
    })).toContain("end time must be later");
    expect(scheduleValidationError({
      ...baseSchedule,
      daysOfWeek: [1, 1],
    })).toContain("unique values");
    expect(scheduleValidationError({
      ...baseSchedule,
      timezone: "Not/AZone",
    })).toContain("valid IANA timezone");
  });
});