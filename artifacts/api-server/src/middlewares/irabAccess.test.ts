import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { hasIrabAccessRole, requireIrabAccess, JWT_SECRET } from "./adminAuth.js";

describe("e'raab access control", () => {
  it("allows exactly developer, admin, and contributor roles", () => {
    assert.equal(hasIrabAccessRole("developer"), true);
    assert.equal(hasIrabAccessRole("admin"), true);
    assert.equal(hasIrabAccessRole("contributor"), true);
    assert.equal(hasIrabAccessRole("moderator"), false);
    assert.equal(hasIrabAccessRole(undefined), false);
  });

  it("rejects requests without an authenticated bearer token", async () => {
    let statusCode: number | undefined;
    let responseBody: unknown;
    let nextCalled = false;
    const req = { headers: {} } as Request;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        responseBody = body;
        return this;
      },
    } as Response;
    const next: NextFunction = () => {
      nextCalled = true;
    };

    await requireIrabAccess(req, res, next);

    assert.equal(statusCode, 401);
    assert.deepEqual(responseBody, { message: "Unauthorized" });
    assert.equal(nextCalled, false);
  });

  for (const role of ["developer", "admin", "contributor"]) {
    it(`validates the original JWT and active account for ${role}`, async () => {
      const account = { id: 1, email: "fixture@example.invalid", role, name: "Fixture", status: "active", tokenRevokedAt: null };
      const select = mock.method(db, "select", (() => ({
        from: () => ({ where: async () => [account] }),
      })) as unknown as typeof db.select);
      try {
        const token = jwt.sign({ userId: 1, email: account.email, role }, JWT_SECRET, { expiresIn: "1m" });
        const req = { headers: { authorization: `Bearer ${token}` } } as Request;
        let nextCalled = false;
        const res = { status() { throw new Error("active authorized fixture must not be rejected"); } } as unknown as Response;
        await requireIrabAccess(req, res, () => { nextCalled = true; });
        assert.equal(nextCalled, true);
        assert.equal(select.mock.calls.length, 1);
      } finally { select.mock.restore(); }
    });
  }

  for (const state of ["disabled", "revoked"]) {
    it(`blocks a ${state} account despite a correctly signed token`, async () => {
      const account = { id: 1, email: "fixture@example.invalid", role: "admin", name: "Fixture",
        status: state === "disabled" ? "disabled" : "active",
        tokenRevokedAt: state === "revoked" ? new Date(Date.now() + 60000) : null };
      const select = mock.method(db, "select", (() => ({
        from: () => ({ where: async () => [account] }),
      })) as unknown as typeof db.select);
      try {
        const token = jwt.sign({ userId: 1, email: account.email, role: account.role }, JWT_SECRET);
        const req = { headers: { authorization: `Bearer ${token}` } } as Request;
        let statusCode = 0;
        const res = { status(code: number) { statusCode = code; return this; }, json() { return this; } } as Response;
        let nextCalled = false;
        await requireIrabAccess(req, res, () => { nextCalled = true; });
        assert.equal(statusCode, 401);
        assert.equal(nextCalled, false);
      } finally { select.mock.restore(); }
    });
  }

  it("blocks unsupported roles and invalid signatures before account lookup", async () => {
    for (const token of [jwt.sign({ email: "fixture@example.invalid", role: "visitor" }, JWT_SECRET), "invalid-token"]) {
      let code = 0;
      const req = { headers: { authorization: `Bearer ${token}` } } as Request;
      const res = { status(status: number) { code = status; return this; }, json() { return this; } } as Response;
      let nextCalled = false;
      await requireIrabAccess(req, res, () => { nextCalled = true; });
      assert.equal(nextCalled, false);
      assert.equal(code, token === "invalid-token" ? 401 : 403);
    }
  });
});