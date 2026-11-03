import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  buildPoemVisibilityWhere,
  filterPoemsForVisibility,
  isPoemVisible,
  mapPublicPoem,
} from "./poemVisibility.js";

test("public list and search visibility includes only published poems", () => {
  const poems = [
    { id: 1, status: "published" },
    { id: 2, status: "pending" },
    { id: 3, status: "draft" },
    { id: 4, status: "rejected" },
    { id: 5, status: null },
    { id: 6 },
  ];

  assert.deepEqual(filterPoemsForVisibility(poems, false).map((poem) => poem.id), [1]);
  assert.deepEqual(filterPoemsForVisibility(poems, true), poems);
});

test("detail visibility fails closed for missing and unpublished statuses", () => {
  assert.equal(isPoemVisible("published", false), true);
  for (const status of ["pending", "draft", "rejected", "unknown", null, undefined]) {
    assert.equal(isPoemVisible(status, false), false, String(status));
    assert.equal(isPoemVisible(status, true), true, String(status));
  }
});

test("public SQL visibility predicate filters to published poems", () => {
  const where = buildPoemVisibilityWhere(false);
  assert.ok(where);
  const query = new PgDialect().sqlToQuery(where);
  assert.match(query.sql.toLowerCase(), /status/);
  assert.deepEqual(query.params, ["published"]);
  assert.equal(buildPoemVisibilityWhere(true), undefined);
});

test("public poem mapping omits creator and contributor identity", () => {
  const poem = mapPublicPoem({
    id: 1,
    title: "Poem",
    titleUrdu: "نظم",
    content: "Text",
    poetName: "Poet",
    poetNameUrdu: "شاعر",
    category: "Love",
    categoryUrdu: "محبت",
    featured: false,
    imageUrl: null,
    likes: 0,
    views: 0,
    shares: 0,
    visualPoetry: false,
    language: "urdu",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    createdByUserId: 99,
    contributorEmail: "contributor@example.test",
    contributorName: "Private Contributor",
    status: "published",
  } as any);

  assert.equal("createdByUserId" in poem, false);
  assert.equal("contributorEmail" in poem, false);
  assert.equal("contributorName" in poem, false);
});
