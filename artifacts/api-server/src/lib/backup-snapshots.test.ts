import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_DATASET_NAMES,
  BACKUP_RESTORE_CONFIRMATION,
  createBackupSnapshot,
  hasRestoreConfirmation,
  mergeBackupDatasets,
  parseBackupData,
  type BackupDatasetName,
  type BackupRestoreAdapter,
} from "./backup-snapshots.js";

const createdAt = new Date("2026-10-07T08:00:00.000Z");

function fixture() {
  return {
    poems: [{
      id: 7,
      title: "A saved poem",
      titleUrdu: "ایک نظم",
      content: "Poem text",
      poetName: "Poet",
      poetNameUrdu: "شاعر",
      category: "ghazal",
      categoryUrdu: "غزل",
      featured: false,
      imageUrl: null,
      likes: 14,
      views: 90,
      shares: 3,
      visualPoetry: false,
      language: "urdu",
      status: "published",
      createdByUserId: null,
      approvedByUserId: null,
      approvedAt: null,
      rejectedByUserId: null,
      rejectedAt: null,
      rejectionReason: null,
      createdAt,
      updatedAt: createdAt,
    }],
    poets: [{
      id: 2, name: "Poet", nameUrdu: "شاعر", bio: "Bio", bioUrdu: "تعارف", era: "Modern",
    }],
    videos: [{
      id: 3, title: "Reading", titleUrdu: "قرأت", description: "A reading",
      youtubeId: "abc123", thumbnailUrl: null, duration: "3:20",
    }],
    categories: [{
      id: 4, name: "Ghazal", nameUrdu: "غزل", slug: "ghazal", description: "Poems",
    }],
    settings: [
      { id: 5, key: "contact_email", value: "hello@example.test" },
      { id: 6, key: "smtp_password", value: "must-not-be-saved" },
    ],
    tools: [{
      id: 8, title: "Poem editor", titleUrdu: "محرر", description: "Tool",
      descriptionUrdu: "آلہ", url: "https://example.test", active: true,
      displayOrder: 1, createdAt,
    }],
  };
}

test("new snapshots include only supported public data and are integrity checked", () => {
  const snapshot = createBackupSnapshot(fixture(), createdAt);
  const parsed = parseBackupData(JSON.stringify(snapshot));

  assert.ok(parsed);
  assert.equal(parsed.formatVersion, 2);
  assert.equal(parsed.integrityValid, true);
  assert.equal(parsed.rowCounts.poems, 1);
  assert.equal(parsed.rowCounts.tools, 1);
  assert.deepEqual(parsed.includedDatasets, [...BACKUP_DATASET_NAMES]);
  assert.deepEqual(parsed.datasets.settings.map(({ key }) => key), ["contact_email"]);
  assert.equal("likes" in parsed.datasets.poems[0], false);
  assert.equal("views" in parsed.datasets.poems[0], false);
  assert.equal("shares" in parsed.datasets.poems[0], false);

  const tampered = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
  tampered.datasets.poems[0].title = "Modified without updating checksum";
  assert.equal(parseBackupData(JSON.stringify(tampered)), null);
});

test("legacy snapshots remain restorable without restoring unapproved settings or counters", () => {
  const original = fixture();
  const parsed = parseBackupData(JSON.stringify({
    timestamp: createdAt.toISOString(),
    poems: original.poems,
    poets: original.poets,
    videos: original.videos,
    categories: original.categories,
    settings: original.settings,
  }));

  assert.ok(parsed);
  assert.equal(parsed.formatVersion, 1);
  assert.equal(parsed.integrityValid, null);
  assert.equal(parsed.datasets.tools.length, 0);
  assert.ok(parsed.includedDatasets.includes("settings"));
  assert.deepEqual(parsed.datasets.settings.map(({ key }) => key), ["contact_email"]);
  assert.equal("likes" in parsed.datasets.poems[0], false);

  const emptySettings = parseBackupData(JSON.stringify({
    poems: original.poems,
    poets: original.poets,
    videos: original.videos,
    categories: original.categories,
    settings: [],
  }));
  assert.ok(emptySettings);
  assert.ok(emptySettings.includedDatasets.includes("settings"));
  assert.equal(parseBackupData(JSON.stringify({
    poems: original.poems,
    poets: original.poets,
    videos: original.videos,
    categories: original.categories,
    settings: {},
  })), null);
});

test("restore confirmation is required and bound to the requested backup", () => {
  assert.equal(hasRestoreConfirmation({
    backupId: 9,
    confirmationPhrase: BACKUP_RESTORE_CONFIRMATION,
  }, 9), true);
  assert.equal(hasRestoreConfirmation({
    backupId: 8,
    confirmationPhrase: BACKUP_RESTORE_CONFIRMATION,
  }, 9), false);
  assert.equal(hasRestoreConfirmation({ backupId: 9 }, 9), false);
  assert.equal(hasRestoreConfirmation({
    backupId: 9,
    confirmationPhrase: "yes",
  }, 9), false);
});

test("a failed transactional restore fixture leaves no partially merged rows", async () => {
  type FixtureState = Record<BackupDatasetName, unknown[]>;
  let state: FixtureState = {
    poems: [],
    poets: [],
    videos: [],
    categories: [],
    settings: [],
    tools: [],
  };
  const before = structuredClone(state);
  const parsed = parseBackupData(JSON.stringify(createBackupSnapshot(fixture(), createdAt)));
  assert.ok(parsed);

  async function runFixtureTransaction(
    operation: (adapter: BackupRestoreAdapter) => Promise<void>,
  ): Promise<void> {
    const staged = structuredClone(state);
    const adapter: BackupRestoreAdapter = {
      async upsert(dataset, rows) {
        if (dataset === "tools") throw new Error("fixture failure");
        staged[dataset] = [...staged[dataset], ...rows];
      },
    };
    await operation(adapter);
    state = staged;
  }

  await assert.rejects(
    runFixtureTransaction((adapter) => mergeBackupDatasets(adapter, parsed.datasets)),
    /fixture failure/,
  );
  assert.deepEqual(state, before);
});

test("successful transactional restore fixture merges each supported dataset", async () => {
  type FixtureState = Record<BackupDatasetName, unknown[]>;
  let state: FixtureState = {
    poems: [],
    poets: [],
    videos: [],
    categories: [],
    settings: [],
    tools: [],
  };
  const parsed = parseBackupData(JSON.stringify(createBackupSnapshot(fixture(), createdAt)));
  assert.ok(parsed);
  const staged = structuredClone(state);
  const adapter: BackupRestoreAdapter = {
    async upsert(dataset, rows) {
      staged[dataset] = [...staged[dataset], ...rows];
    },
  };

  await mergeBackupDatasets(adapter, parsed.datasets);
  state = staged;
  assert.deepEqual(Object.fromEntries(BACKUP_DATASET_NAMES.map((name) => [name, state[name].length])), {
    poems: 1, poets: 1, videos: 1, categories: 1, settings: 1, tools: 1,
  });
});
