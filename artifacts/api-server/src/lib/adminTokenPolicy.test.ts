import assert from "node:assert/strict";
import test from "node:test";
import jwt, { type SignOptions } from "jsonwebtoken";
import {
  matchesActiveAccount,
  verifyOptionalPrivilegedToken,
  type AccountTokenState,
} from "./adminTokenPolicy.js";

const TEST_SECRET = "unit-test-only-secret";
const activeAdmin: AccountTokenState = {
  id: 12,
  email: "admin@example.test",
  role: "admin",
  status: "active",
  tokenRevokedAt: null,
};

function bearer(role: string, expiresIn: SignOptions["expiresIn"] = "5m"): string {
  const token = jwt.sign(
    { email: activeAdmin.email, role },
    TEST_SECRET,
    { expiresIn },
  );
  return `Bearer ${token}`;
}

test("valid active Admin and Developer tokens can be considered for privileged visibility", () => {
  for (const role of ["admin", "developer"] as const) {
    const account = { ...activeAdmin, role };
    const payload = verifyOptionalPrivilegedToken(bearer(role), TEST_SECRET);
    assert.ok(payload);
    assert.equal(matchesActiveAccount(payload, account), true);
  }
});

test("invalid, expired, and non-privileged bearer tokens grant no visibility privilege", () => {
  assert.equal(verifyOptionalPrivilegedToken(undefined, TEST_SECRET), null);
  assert.equal(verifyOptionalPrivilegedToken("Bearer not-a-jwt", TEST_SECRET), null);
  assert.equal(verifyOptionalPrivilegedToken(bearer("admin", -1), TEST_SECRET), null);
  assert.equal(verifyOptionalPrivilegedToken(bearer("contributor"), TEST_SECRET), null);
});

test("disabled, missing, or mismatched accounts fail active-account validation", () => {
  const payload = { email: activeAdmin.email, role: "admin" as const, iat: 100 };

  assert.equal(matchesActiveAccount(payload, { ...activeAdmin, status: "disabled" }), false);
  assert.equal(matchesActiveAccount(payload, null), false);
  assert.equal(matchesActiveAccount(payload, { ...activeAdmin, email: "other@example.test" }), false);
  assert.equal(matchesActiveAccount(payload, { ...activeAdmin, role: "developer" }), false);
});

test("revoked tokens require a valid issue time at or after revocation", () => {
  const revokedAccount = {
    ...activeAdmin,
    tokenRevokedAt: new Date(101_000),
  };

  assert.equal(matchesActiveAccount({ email: activeAdmin.email, role: "admin", iat: 100 }, revokedAccount), false);
  assert.equal(matchesActiveAccount({ email: activeAdmin.email, role: "admin", iat: 102 }, revokedAccount), true);
  assert.equal(matchesActiveAccount({ email: activeAdmin.email, role: "admin" }, revokedAccount), false);
});
