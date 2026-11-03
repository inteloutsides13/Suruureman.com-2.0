import assert from "node:assert/strict";
import { test } from "node:test";
import { contributorApplicationsTable, usersTable } from "@workspace/db/schema";

// Synthetic fixtures only: no database connection or production records.
const columns = [
  usersTable.activationPendingAt,
  contributorApplicationsTable.termsAcceptedAt,
  contributorApplicationsTable.reviewedAt,
  contributorApplicationsTable.activationExpiresAt,
  contributorApplicationsTable.activationUsedAt,
  contributorApplicationsTable.createdAt,
  contributorApplicationsTable.updatedAt,
];

for (const column of columns) {
  test(`${column.name} preserves the existing database's timezone-aware timestamps`, () => {
    assert.equal(column.getSQLType(), "timestamp with time zone");
    for (const input of [
      "2000-01-02 03:04:05+00",
      "2000-01-02 08:04:05+05",
      "2000-01-01 22:04:05-05",
    ]) {
      const decoded = column.mapFromDriverValue(input);
      assert.ok(decoded instanceof Date);
      assert.equal(decoded.toISOString(), "2000-01-02T03:04:05.000Z");
    }
  });
}
