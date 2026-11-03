import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import express from "express";
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "@workspace/db";
import { poemsTable, poetsTable } from "@workspace/db/schema";
import apiRouter from "./index.js";

type FixturePoem = {
  id: number;
  title: string;
  titleUrdu: string;
  content: string;
  poetName: string;
  poetNameUrdu: string;
  category: string;
  categoryUrdu: string;
  featured: boolean;
  imageUrl: string | null;
  likes: number;
  views: number;
  shares: number;
  visualPoetry: boolean;
  language: string;
  status: "published" | "pending" | "draft" | "rejected";
  createdAt: Date;
  updatedAt: Date;
};

type FixturePoet = {
  id: number;
  name: string;
  nameUrdu: string;
  bio: string;
  bioUrdu: string;
  era: string;
};

type Fixture = {
  poems: FixturePoem[];
  poets: FixturePoet[];
};

const app = express();
app.use(express.json());
app.use("/api", apiRouter);

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

function makePoem(
  id: number,
  poetName: string,
  status: FixturePoem["status"] = "published",
  createdAt = new Date(`2026-01-${String(id).padStart(2, "0")}T00:00:00.000Z`),
): FixturePoem {
  return {
    id,
    title: `Poem ${id}`,
    titleUrdu: `عنوان ${id}`,
    content: `Content ${id}`,
    poetName,
    poetNameUrdu: `شاعر ${poetName}`,
    category: "ghazal",
    categoryUrdu: "غزل",
    featured: false,
    imageUrl: null,
    likes: 0,
    views: 5,
    shares: 0,
    visualPoetry: false,
    language: "urdu",
    status,
    createdAt,
    updatedAt: createdAt,
  };
}

function makePoet(id: number, name: string): FixturePoet {
  return {
    id,
    name,
    nameUrdu: `شاعر ${name}`,
    bio: `Biography ${name}`,
    bioUrdu: `تعارف ${name}`,
    era: "Classical",
  };
}

async function requestWithFixture(path: string, fixture: Fixture) {
  const writes: string[] = [];
  const dialect = new PgDialect();

  const selectMock = mock.method(
    db,
    "select",
    ((fields?: Record<string, unknown>) => {
      let table: unknown;
      let where: Parameters<PgDialect["sqlToQuery"]>[0] | undefined;
      let grouped = false;
      let ordered = false;
      let limit: number | undefined;
      let offset = 0;

      const builder: any = {
        from(value: unknown) {
          table = value;
          return builder;
        },
        where(value: Parameters<PgDialect["sqlToQuery"]>[0]) {
          where = value;
          return builder;
        },
        groupBy() {
          grouped = true;
          return builder;
        },
        orderBy() {
          ordered = true;
          return builder;
        },
        limit(value: number) {
          limit = value;
          return builder;
        },
        offset(value: number) {
          offset = value;
          return builder;
        },
          then(
          resolve: (value: unknown[]) => unknown,
          reject: (reason: unknown) => unknown,
        ) {
          return Promise.resolve().then(() => {
            if (table === poetsTable) {
              if (!where) return fixture.poets;
              const params = dialect.sqlToQuery(where).params;
              const ids = params.filter(
                (value): value is number => typeof value === "number",
              );
              return ids.length > 0
                ? fixture.poets.filter((poet) => ids.includes(poet.id))
                : fixture.poets;
            }
            assert.equal(table, poemsTable, "unexpected table read");
            assert.ok(where, "public poem queries must have a visibility predicate");

            const query = dialect.sqlToQuery(where);
            assert.ok(
              query.params.includes("published"),
              "public poem queries must filter to published status",
            );
            const params = query.params;
            let rows = fixture.poems.filter((poem) => poem.status === "published");

            const poetNames = fixture.poets.map((poet) => poet.name);
            const matchedPoetNames = poetNames.filter((name) => params.includes(name));
            if (ordered || (fields && "total" in fields && !grouped)) {
              assert.ok(
                matchedPoetNames.length > 0,
                "poet poem reads must be scoped to the requested poet",
              );
            }
            if (matchedPoetNames.length > 0) {
              rows = rows.filter((poem) => matchedPoetNames.includes(poem.poetName));
            }

            const ids = params.filter(
              (value): value is number => typeof value === "number",
            );
            if (ids.length > 0) rows = rows.filter((poem) => ids.includes(poem.id));

            if (fields && "poetName" in fields && grouped) {
              const counts = new Map<string, number>();
              for (const poem of rows) {
                counts.set(poem.poetName, (counts.get(poem.poetName) ?? 0) + 1);
              }
              return [...counts].map(([poetName, total]) => ({ poetName, total }));
            }

            if (fields && "total" in fields) return [{ total: rows.length }];

            if (ordered) {
              rows = rows.sort(
                (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
              );
            }
            return rows.slice(offset, limit === undefined ? undefined : offset + limit);
          }).then(resolve, reject);
        },
      };
      return builder;
    }) as unknown as typeof db.select,
  );
  const updateMock = mock.method(
    db,
    "update",
    (() => {
      writes.push("update");
      throw new Error("SEO read routes must not update records");
    }) as unknown as typeof db.update,
  );
  const insertMock = mock.method(
    db,
    "insert",
    (() => {
      writes.push("insert");
      throw new Error("SEO read routes must not insert records");
    }) as unknown as typeof db.insert,
  );

  try {
    const response = await fetch(`${baseUrl}${path}`);
    const body = (await response.json()) as Record<string, any>;
    return { response, body, writes };
  } finally {
    selectMock.mock.restore();
    updateMock.mock.restore();
    insertMock.mock.restore();
  }
}

test("public SEO poem lookup returns published poems and hides missing or unpublished IDs", async () => {
  const fixture: Fixture = {
    poets: [makePoet(1, "Poet One")],
    poems: [
      makePoem(1, "Poet One", "published"),
      makePoem(2, "Poet One", "pending"),
    ],
  };

  const published = await requestWithFixture("/api/seo/poems/1", fixture);
  assert.equal(published.response.status, 200);
  assert.equal(published.body.id, 1);
  assert.equal(published.body.status, "published");
  assert.deepEqual(published.writes, []);

  const unpublished = await requestWithFixture("/api/seo/poems/2", fixture);
  assert.equal(unpublished.response.status, 404);
  assert.deepEqual(unpublished.writes, []);

  const missing = await requestWithFixture("/api/seo/poems/999", fixture);
  assert.equal(missing.response.status, 404);
  assert.deepEqual(missing.writes, []);
});

test("public SEO poet list preserves source order and counts published poems only", async () => {
  const fixture: Fixture = {
    poets: [
      makePoet(9, "Second"),
      makePoet(3, "First"),
      makePoet(14, "No Published Poems"),
    ],
    poems: [
      makePoem(1, "Second", "published"),
      makePoem(2, "Second", "draft"),
      makePoem(3, "First", "published"),
      makePoem(4, "First", "rejected"),
    ],
  };

  const result = await requestWithFixture("/api/seo/poets", fixture);
  assert.equal(result.response.status, 200);
  assert.deepEqual(
    result.body.poets.map((poet: FixturePoet & { poemCount: number }) => [
      poet.id,
      poet.name,
      poet.poemCount,
    ]),
    [
      [9, "Second", 1],
      [3, "First", 1],
      [14, "No Published Poems", 0],
    ],
  );
  assert.deepEqual(result.writes, []);
});

test("public SEO poet detail paginates published poems and keeps zero-poem profiles public", async () => {
  const fixture: Fixture = {
    poets: [makePoet(7, "Poet Seven"), makePoet(8, "No Published Poems")],
    poems: [
      makePoem(1, "Poet Seven", "published", new Date("2026-01-01T00:00:00.000Z")),
      makePoem(2, "Poet Seven", "published", new Date("2026-01-02T00:00:00.000Z")),
      makePoem(3, "Poet Seven", "published", new Date("2026-01-03T00:00:00.000Z")),
      makePoem(4, "Poet Seven", "pending", new Date("2026-01-04T00:00:00.000Z")),
    ],
  };

  const page = await requestWithFixture(
    "/api/seo/poets/7?limit=1&offset=1",
    fixture,
  );
  assert.equal(page.response.status, 200);
  assert.equal(page.body.poemCount, 3);
  assert.deepEqual(page.body.poems.map((poem: FixturePoem) => poem.id), [2]);
  assert.ok(page.body.poems.every((poem: FixturePoem) => poem.status === "published"));
  assert.deepEqual(page.writes, []);

  const zeroPoemProfile = await requestWithFixture(
    "/api/seo/poets/8?limit=12&offset=0",
    fixture,
  );
  assert.equal(zeroPoemProfile.response.status, 200);
  assert.equal(zeroPoemProfile.body.id, 8);
  assert.equal(zeroPoemProfile.body.poemCount, 0);
  assert.deepEqual(zeroPoemProfile.body.poems, []);
  assert.deepEqual(zeroPoemProfile.writes, []);
});

test("public SEO poet detail returns 404 for an unknown poet and validates pagination", async () => {
  const fixture: Fixture = { poets: [makePoet(1, "Known")], poems: [] };

  const missing = await requestWithFixture("/api/seo/poets/999", fixture);
  assert.equal(missing.response.status, 404);
  assert.deepEqual(missing.writes, []);

  const invalidLimit = await requestWithFixture(
    "/api/seo/poets/1?limit=-1",
    fixture,
  );
  assert.equal(invalidLimit.response.status, 400);
  assert.deepEqual(invalidLimit.writes, []);
});
