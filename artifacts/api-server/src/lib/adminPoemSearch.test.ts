import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  buildAdminPoemSearchWhereClause,
  isSupportedPoemLanguage,
  parseAdminPoemsQuery,
} from "./adminPoemSearch.js";
import { poemLanguageFilterValues, poemLanguageMatchesFilter } from "./poemLanguageAliases.js";

test("admin poem search accepts supported languages and rejects arbitrary values", () => {
  for (const language of [
    "urdu",
    "punjabi",
    "arabic",
    "persian",
    "farsi",
    "hindi",
    "siraiki",
    "english",
    "spanish",
    "punjabi-shahmukhi",
  ]) {
    assert.equal(isSupportedPoemLanguage(language), true, language);
  }

  for (const language of ["gurmukhi", "pashto", "", null, undefined]) {
    assert.equal(isSupportedPoemLanguage(language), false, String(language));
  }
});

test("admin poem query preserves language, pagination and trimmed search", () => {
  assert.deepEqual(
    parseAdminPoemsQuery({
      search: "  Roomi  ",
      language: "punjabi",
      limit: "25",
      offset: "50",
    }),
    { search: "Roomi", language: "punjabi", limit: 25, offset: 50 },
  );
  assert.deepEqual(parseAdminPoemsQuery({}), {
    limit: 2000,
    offset: 0,
    search: undefined,
    language: undefined,
  });
  assert.equal(parseAdminPoemsQuery({ language: "gurmukhi" }), null);
  assert.equal(parseAdminPoemsQuery({ limit: "2.5" }), null);
});

test("search SQL includes all six protected poem and contributor fields", () => {
  const where = buildAdminPoemSearchWhereClause("Abdul Qadir");
  assert.ok(where);
  const compiled = new PgDialect().sqlToQuery(where);
  const sql = compiled.sql.toLowerCase();

  for (const column of ["title", "title_urdu", "content", "poet_name", "poet_name_urdu", "name"]) {
    assert.ok(sql.includes(column), `expected ${column} in search SQL`);
  }
  assert.equal(compiled.params.length, 6);
  assert.deepEqual(compiled.params, Array(6).fill("%Abdul Qadir%"));
});

test("language filter is combined with partial, case-insensitive search", () => {
  const where = buildAdminPoemSearchWhereClause("Roomi", "punjabi");
  assert.ok(where);
  const compiled = new PgDialect().sqlToQuery(where);

  assert.match(compiled.sql.toLowerCase(), /ilike/);
  assert.ok(compiled.params.includes("%Roomi%"));
  assert.ok(compiled.params.includes("punjabi"));
});

test("Persian and legacy Farsi filters both include either stored code", () => {
  assert.deepEqual(poemLanguageFilterValues("persian"), ["persian", "farsi"]);
  assert.deepEqual(poemLanguageFilterValues("farsi"), ["persian", "farsi"]);
  assert.equal(poemLanguageMatchesFilter("persian", "farsi"), true);
  assert.equal(poemLanguageMatchesFilter("farsi", "persian"), true);
  assert.equal(poemLanguageMatchesFilter("urdu", "persian"), false);

  for (const filter of ["persian", "farsi"]) {
    const where = buildAdminPoemSearchWhereClause(undefined, filter);
    assert.ok(where);
    const compiled = new PgDialect().sqlToQuery(where);
    assert.match(compiled.sql.toLowerCase(), / in /);
    assert.deepEqual(compiled.params, ["persian", "farsi"]);
  }
});

test("search treats SQL wildcard characters as literal input", () => {
  const where = buildAdminPoemSearchWhereClause("50%_done");
  assert.ok(where);
  const compiled = new PgDialect().sqlToQuery(where);
  assert.deepEqual(compiled.params, Array(6).fill("%50\\%\\_done%"));
});

test("empty search and language produce no extra filter", () => {
  assert.equal(buildAdminPoemSearchWhereClause("   "), undefined);
});
