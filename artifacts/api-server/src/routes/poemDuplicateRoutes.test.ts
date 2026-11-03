import assert from "node:assert/strict";
import { after, before, test, mock } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import type { PoemDuplicateRecord } from "../lib/poemDuplicatePrevention.js";
import { JWT_SECRET } from "../middlewares/adminAuth.js";
import apiRouter from "./index.js";

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
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

const poem = (overrides: Partial<PoemDuplicateRecord> = {}): PoemDuplicateRecord & Record<string, unknown> => ({
  id: 1,
  title: "A poem",
  titleUrdu: "عنوان",
  poetName: "Poet",
  poetNameUrdu: "شاعر",
  content: "پہلا مصرع\nدوسرا مصرع",
  category: "ghazal",
  categoryUrdu: "غزل",
  imageUrl: null,
  featured: false,
  visualPoetry: false,
  language: "urdu",
  likes: 0,
  views: 0,
  shares: 0,
  status: "published",
  createdByUserId: null,
  approvedByUserId: null,
  approvedAt: null,
  rejectedByUserId: null,
  rejectedAt: null,
  rejectionReason: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  ...overrides,
});

const body = (overrides: Record<string, unknown> = {}) => ({
  title: "A poem",
  titleUrdu: "عنوان",
  poetName: "Poet",
  poetNameUrdu: "شاعر",
  content: "پہلا مصرع\nدوسرا مصرع",
  category: "ghazal",
  categoryUrdu: "غزل",
  language: "urdu",
  imageUrl: null,
  featured: false,
  ...overrides,
});

interface RouteFixture {
  poems: Array<PoemDuplicateRecord & Record<string, unknown>>;
  current?: PoemDuplicateRecord & Record<string, unknown>;
  writes?: string[];
}

async function requestWithFixture(args: {
  path: string;
  method: string;
  role: "admin" | "developer" | "contributor";
  body?: unknown;
  fixture: RouteFixture;
}) {
  const { fixture } = args;
  const writes = fixture.writes ?? [];
  const account = {
    id: args.role === "contributor" ? 7 : 3,
    email: `${args.role}@example.invalid`,
    role: args.role,
    name: "Test account",
    status: "active",
    tokenRevokedAt: null,
  };
  const authSelect = mock.method(db, "select", (() => ({
    from: () => ({ where: async () => [account] }),
  })) as unknown as typeof db.select);

  const query = (rows: unknown[]) => {
    const builder: any = {
      from: () => builder,
      where: async () => rows,
      then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    };
    return builder;
  };
  const tx: any = {
    async execute() { writes.push("lock"); return {}; },
    select(fields?: unknown) {
      return query(fields ? fixture.poems : fixture.current ? [fixture.current] : []);
    },
    insert() {
      return {
        values: async () => {
          writes.push("insert");
          throw new Error("Unexpected insert in duplicate-route fixture");
        },
      };
    },
    update() {
      return {
        set: (values: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => {
              writes.push("update");
              return [{ ...(fixture.current ?? poem()), ...values }];
            },
          }),
        }),
      };
    },
  };

  const transaction = mock.method(db, "transaction", (async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(tx)) as typeof db.transaction);
  const auditInsert = mock.method(db, "insert", (() => ({
    values: async () => { throw new Error("Audit write intentionally mocked"); },
  })) as unknown as typeof db.insert);

  try {
    const token = jwt.sign({ userId: account.id, email: account.email, role: args.role }, JWT_SECRET);
    return await fetch(`${baseUrl}${args.path}`, {
      method: args.method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: args.body === undefined ? undefined : JSON.stringify(args.body),
    });
  } finally {
    authSelect.mock.restore();
    transaction.mock.restore();
    auditInsert.mock.restore();
  }
}

test("Admin and Developer create return 409 with authorized matching-poem details", async () => {
  for (const role of ["admin", "developer"] as const) {
    const res = await requestWithFixture({
      path: "/api/poems",
      method: "POST",
      role,
      body: body(),
      fixture: { poems: [poem({ id: 42 })] },
    });
    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), {
      message: "A poem with this Urdu title by the same poet already exists. Review the existing poem before submitting.",
      duplicate: { id: 42, titleUrdu: "عنوان", poetNameUrdu: "شاعر" },
    });
  }
});

test("Admin and Developer edit allow unchanged legacy duplicate identity", async () => {
  for (const role of ["admin", "developer"] as const) {
    const current = poem({ id: 10 });
    const res = await requestWithFixture({
      path: "/api/poems/10",
      method: "PUT",
      role,
      body: body({ title: "Edited English title" }),
      fixture: { poems: [current, poem({ id: 20 })], current, writes: [] },
    });
    assert.equal(res.status, 200);
  }
});

test("Admin and Developer edit reject a newly introduced duplicate", async () => {
  for (const role of ["admin", "developer"] as const) {
    const current = poem({ id: 10, titleUrdu: "پرانا عنوان", content: "پرانا مواد" });
    const res = await requestWithFixture({
      path: "/api/poems/10",
      method: "PUT",
      role,
      body: body(),
      fixture: { poems: [current, poem({ id: 42 })], current },
    });
    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), {
      message: "A poem with this Urdu title by the same poet already exists. Review the existing poem before submitting.",
      duplicate: { id: 42, titleUrdu: "عنوان", poetNameUrdu: "شاعر" },
    });
  }
});

test("Contributor create returns a generic 409 for another contributor's unpublished duplicate", async () => {
  const res = await requestWithFixture({
    path: "/api/contributor/poems",
    method: "POST",
    role: "contributor",
    body: body({ titleUrdu: "Different title" }),
    fixture: { poems: [poem({ id: 42, titleUrdu: "Existing title", status: "pending", createdByUserId: 99 })] },
  });
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), {
    message: "This submission may duplicate an existing poem. Please contact an editor.",
  });
});

test("Contributor create includes details for their own unpublished duplicate", async () => {
  const res = await requestWithFixture({
    path: "/api/contributor/poems",
    method: "POST",
    role: "contributor",
    body: body(),
    fixture: { poems: [poem({ id: 42, status: "pending", createdByUserId: 7 })] },
  });
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), {
    message: "A poem with this Urdu title by the same poet already exists. Review the existing poem before submitting.",
    duplicate: { id: 42, titleUrdu: "عنوان", poetNameUrdu: "شاعر" },
  });
});

test("Contributor edit returns 409 for a newly introduced unpublished content collision", async () => {
  const current = poem({ id: 10, status: "pending", createdByUserId: 7, content: "Old content" });
  const res = await requestWithFixture({
    path: "/api/contributor/poems/10",
    method: "PUT",
    role: "contributor",
    body: body({ titleUrdu: "Different title" }),
    fixture: {
      poems: [current, poem({ id: 20, status: "pending", createdByUserId: 99 })],
      current,
    },
  });
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), {
    message: "This submission may duplicate an existing poem. Please contact an editor.",
  });
});

test("Contributor edit allows unchanged legacy duplicate identity", async () => {
  const current = poem({ id: 10, status: "pending", createdByUserId: 7 });
  const writes: string[] = [];
  const res = await requestWithFixture({
    path: "/api/contributor/poems/10",
    method: "PUT",
    role: "contributor",
    body: body({ title: "Edited English title" }),
    fixture: { poems: [current, poem({ id: 20 })], current, writes },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(writes, ["lock", "update"]);
});

test("Contributor approval returns 409 with authorized admin details and does not publish", async () => {
  const pending = poem({ id: 10, status: "pending", createdByUserId: 7 });
  const writes: string[] = [];
  const res = await requestWithFixture({
    path: "/api/admin/poems/10/approve",
    method: "POST",
    role: "admin",
    fixture: { poems: [pending, poem({ id: 20 })], current: pending, writes },
  });
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), {
    message: "A poem with this Urdu title by the same poet already exists. Review the existing poem before submitting.",
    duplicate: { id: 20, titleUrdu: "عنوان", poetNameUrdu: "شاعر" },
  });
  assert.deepEqual(writes, ["lock"]);
});
