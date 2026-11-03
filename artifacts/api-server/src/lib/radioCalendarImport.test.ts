import assert from "node:assert/strict";
import test, { mock } from "node:test";
import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import {
  importRadioCalendarProgrammes,
  findRadioCalendarImportIssues,
  parseRadioCalendarImport,
} from "./radioCalendarImport.js";
import { radioCalendarInput } from "./radioCalendar.js";
import { JWT_SECRET, requireAdmin } from "../middlewares/adminAuth.js";
import type { RadioCalendarInput } from "./radioCalendar.js";

function programme(titleEn: string, startTime = "08:00", programmeDate = "2026-10-12"): RadioCalendarInput {
  return radioCalendarInput.parse({
    titleEn,
    titleUr: `${titleEn} اردو`,
    descriptionEn: "Demo description",
    descriptionUr: "نمونہ تفصیل",
    programmeType: "Recorded Show",
    programmeDate,
    startTime,
    endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`,
    timezone: "Europe/Berlin",
    externalLink: null,
    publicNote: null,
  });
}

function fakePool(options: {
  existing?: Array<Record<string, unknown>>;
  failOnInsert?: number;
} = {}) {
  const statements: string[] = [];
  let inserted = 0;
  let released = false;
  const client = {
    async query(sql: string) {
      statements.push(sql.trim().split(/\s+/).slice(0, 3).join(" "));
      if (sql.includes("FROM radio_calendar_programmes")) return { rows: options.existing ?? [] };
      if (sql.includes("INSERT INTO radio_calendar_programmes")) {
        inserted += 1;
        if (inserted === options.failOnInsert) throw new Error("fixture insert failure");
        return { rows: [{ id: inserted, status: "draft" }] };
      }
      return { rows: [] };
    },
    release() {
      released = true;
    },
  };
  return {
    pool: { connect: async () => client } as unknown as Pick<Pool, "connect">,
    statements,
    get inserted() { return inserted; },
    get released() { return released; },
  };
}

test("import parser validates every item with the shared schema and Berlin timezone", () => {
  assert.deepEqual(parseRadioCalendarImport([programme("Valid")]).success, true);
  assert.equal(parseRadioCalendarImport([{ ...programme("Bad timezone"), timezone: "Asia/Dubai" }]).success, false);
  assert.equal(parseRadioCalendarImport([{ ...programme("Bad type"), programmeType: "Legacy" }]).success, false);
  assert.equal(parseRadioCalendarImport([{ ...programme("Bad date"), programmeDate: "2026-02-30" }]).success, false);
  assert.equal(parseRadioCalendarImport([{ ...programme("Bad time"), startTime: "20:00", endTime: "19:00" }]).success, false);
  assert.equal(parseRadioCalendarImport("not an array").success, false);
});

test("import rejects duplicate programmes within the file or already in the calendar", () => {
  const first = programme("Repeat");
  const duplicate = programme(" repeat ", "10:00");
  assert.equal(findRadioCalendarImportIssues([first, duplicate], []).some((issue) => issue.kind === "duplicate"), true);
  assert.equal(findRadioCalendarImportIssues([first], [{
    titleEn: "REPEAT",
    titleUr: "ترجمہ",
    programmeDate: "2026-10-12",
    startTime: "16:00",
    endTime: "17:00",
    status: "published",
  }]).some((issue) => issue.kind === "duplicate"), true);
});

test("import rejects overlaps with existing and imported programmes", () => {
  const first = programme("First", "08:00");
  const second = programme("Second", "08:30");
  const existingOverlap = [{
    titleEn: "Existing slot",
    titleUr: "موجودہ",
    programmeDate: "2026-10-12",
    startTime: "08:45:00",
    endTime: "09:45:00",
    status: "published",
  }];
  assert.equal(findRadioCalendarImportIssues([first], existingOverlap).some((issue) => issue.kind === "overlap"), true);
  assert.equal(findRadioCalendarImportIssues([first, second], []).some((issue) => issue.kind === "overlap"), true);
  assert.equal(findRadioCalendarImportIssues([first], [{ ...existingOverlap[0], status: "cancelled" }]).length, 0);
});

test("bulk import creates all programmes as drafts in one transaction", async () => {
  const fixture = fakePool();
  const inserted = await importRadioCalendarProgrammes(fixture.pool, [programme("One"), programme("Two", "12:00")]);
  assert.equal(inserted.length, 2);
  assert.equal(fixture.statements[0], "BEGIN");
  assert.ok(fixture.statements.includes("LOCK TABLE radio_calendar_programmes"));
  assert.equal(fixture.statements.at(-1), "COMMIT");
  assert.equal(fixture.statements.filter((statement) => statement === "INSERT INTO radio_calendar_programmes").length, 2);
  assert.equal(fixture.released, true);
});

test("bulk import rolls back all earlier inserts when any insert fails", async () => {
  const fixture = fakePool({ failOnInsert: 2 });
  await assert.rejects(
    importRadioCalendarProgrammes(fixture.pool, [programme("One"), programme("Two", "12:00")]),
    /fixture insert failure/,
  );
  assert.equal(fixture.inserted, 2);
  assert.equal(fixture.statements.includes("COMMIT"), false);
  assert.equal(fixture.statements.at(-1), "ROLLBACK");
  assert.equal(fixture.released, true);
});

test("bulk import performs duplicate and conflict checks before the first insert", async () => {
  const fixture = fakePool({ existing: [{
    titleEn: "Existing",
    titleUr: "موجودہ",
    programmeDate: "2026-10-12",
    startTime: "08:30:00",
    endTime: "09:30:00",
    status: "published",
  }] });
  await assert.rejects(
    importRadioCalendarProgrammes(fixture.pool, [programme("Incoming")]),
    /conflicts with existing programme times/,
  );
  assert.equal(fixture.inserted, 0);
  assert.equal(fixture.statements.at(-1), "ROLLBACK");
});

test("bulk import prevents previously imported demos from being inserted again", async () => {
  const fixture = fakePool({ existing: [{
    titleEn: "Repeat",
    titleUr: "ترجمہ",
    programmeDate: "2026-10-12",
    startTime: "16:00:00",
    endTime: "17:00:00",
    status: "draft",
  }] });
  await assert.rejects(
    importRadioCalendarProgrammes(fixture.pool, [programme("repeat", "08:00")]),
    /already in the calendar/,
  );
  assert.equal(fixture.inserted, 0);
  assert.equal(fixture.statements.at(-1), "ROLLBACK");
});

test("Admin API authorization allows active admin/developer and blocks contributors", async () => {
  for (const role of ["admin", "developer"]) {
    const account = { id: 7, email: "calendar-admin@example.invalid", role, name: "Calendar Admin", status: "active", tokenRevokedAt: null };
    const select = mock.method(db, "select", (() => ({
      from: () => ({ where: async () => [account] }),
    })) as unknown as typeof db.select);
    try {
      const req = { headers: { authorization: `Bearer ${jwt.sign({ userId: account.id, email: account.email, role }, JWT_SECRET)}` } } as Request;
      let statusCode = 0;
      let nextCalled = false;
      const res = {
        status(code: number) { statusCode = code; return this; },
        json() { return this; },
      } as unknown as Response;
      await requireAdmin(req, res, (() => { nextCalled = true; }) as NextFunction);
      assert.equal(nextCalled, true, `${role} should be authorized`);
      assert.equal(statusCode, 0);
    } finally {
      select.mock.restore();
    }
  }

  const req = { headers: { authorization: `Bearer ${jwt.sign({ userId: 7, email: "calendar-admin@example.invalid", role: "contributor" }, JWT_SECRET)}` } } as Request;
  let deniedStatus = 0;
  let deniedNext = false;
  const deniedRes = {
    status(code: number) { deniedStatus = code; return this; },
    json() { return this; },
  } as unknown as Response;
  await requireAdmin(req, deniedRes, (() => { deniedNext = true; }) as NextFunction);
  assert.equal(deniedStatus, 403);
  assert.equal(deniedNext, false);

  let unauthenticatedStatus = 0;
  const unauthenticatedRes = {
    status(code: number) { unauthenticatedStatus = code; return this; },
    json() { return this; },
  } as unknown as Response;
  await requireAdmin({ headers: {} } as Request, unauthenticatedRes, (() => { throw new Error("must not continue"); }) as NextFunction);
  assert.equal(unauthenticatedStatus, 401);
});
