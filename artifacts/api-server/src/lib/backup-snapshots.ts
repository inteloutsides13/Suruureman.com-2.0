import { createHash } from "node:crypto";
import { z } from "zod/v4";

export const BACKUP_DATASET_NAMES = [
  "poems",
  "poets",
  "videos",
  "categories",
  "settings",
  "tools",
] as const;

export type BackupDatasetName = (typeof BACKUP_DATASET_NAMES)[number];

export const PUBLIC_BACKUP_SETTING_KEYS = [
  "contact_email",
  "contact_phone",
  "contact_address",
  "social_facebook",
  "social_twitter",
  "social_youtube",
  "social_tiktok",
  "social_instagram",
] as const;

type PublicBackupSettingKey = (typeof PUBLIC_BACKUP_SETTING_KEYS)[number];

const idSchema = z.number().int().positive();
const dateSchema = z.union([z.date(), z.iso.datetime({ offset: true })]).transform((value) =>
  value instanceof Date ? value : new Date(value),
);
const nullableDateSchema = dateSchema.nullable();
const settingKeySchema = z.enum(PUBLIC_BACKUP_SETTING_KEYS);
const datasetNameSchema = z.enum(BACKUP_DATASET_NAMES);

const poemRowSchema = z.object({
  id: idSchema,
  title: z.string(),
  titleUrdu: z.string(),
  content: z.string(),
  poetName: z.string(),
  poetNameUrdu: z.string(),
  category: z.string(),
  categoryUrdu: z.string(),
  featured: z.boolean(),
  imageUrl: z.string().nullable(),
  visualPoetry: z.boolean(),
  language: z.string(),
  status: z.enum(["published", "pending", "rejected", "draft"]),
  createdByUserId: idSchema.nullable(),
  approvedByUserId: idSchema.nullable(),
  approvedAt: nullableDateSchema,
  rejectedByUserId: idSchema.nullable(),
  rejectedAt: nullableDateSchema,
  rejectionReason: z.string().nullable(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

const poetRowSchema = z.object({
  id: idSchema,
  name: z.string(),
  nameUrdu: z.string(),
  bio: z.string(),
  bioUrdu: z.string(),
  era: z.string(),
});

const videoRowSchema = z.object({
  id: idSchema,
  title: z.string(),
  titleUrdu: z.string(),
  description: z.string(),
  youtubeId: z.string(),
  thumbnailUrl: z.string().nullable(),
  duration: z.string(),
});

const categoryRowSchema = z.object({
  id: idSchema,
  name: z.string(),
  nameUrdu: z.string(),
  slug: z.string(),
  description: z.string(),
});

const settingRowSchema = z.object({
  id: idSchema,
  key: settingKeySchema,
  value: z.string(),
});

const toolRowSchema = z.object({
  id: idSchema,
  title: z.string(),
  titleUrdu: z.string(),
  description: z.string(),
  descriptionUrdu: z.string(),
  url: z.string(),
  active: z.boolean(),
  displayOrder: z.number().int(),
  createdAt: dateSchema,
});

const v2DatasetSchemas = {
  poems: poemRowSchema.strict(),
  poets: poetRowSchema.strict(),
  videos: videoRowSchema.strict(),
  categories: categoryRowSchema.strict(),
  settings: settingRowSchema.strict(),
  tools: toolRowSchema.strict(),
};

const datasetRowsSchema = z.object({
  poems: z.array(poemRowSchema),
  poets: z.array(poetRowSchema),
  videos: z.array(videoRowSchema),
  categories: z.array(categoryRowSchema),
  settings: z.array(settingRowSchema),
  tools: z.array(toolRowSchema),
});

const v2DatasetRowsSchema = z.object({
  poems: z.array(v2DatasetSchemas.poems),
  poets: z.array(v2DatasetSchemas.poets),
  videos: z.array(v2DatasetSchemas.videos),
  categories: z.array(v2DatasetSchemas.categories),
  settings: z.array(v2DatasetSchemas.settings),
  tools: z.array(v2DatasetSchemas.tools),
}).strict();

const rowCountsSchema = z.object({
  poems: z.number().int().nonnegative(),
  poets: z.number().int().nonnegative(),
  videos: z.number().int().nonnegative(),
  categories: z.number().int().nonnegative(),
  settings: z.number().int().nonnegative(),
  tools: z.number().int().nonnegative(),
}).strict();

const v2SnapshotSchema = z.object({
  schemaVersion: z.literal(2),
  createdAt: dateSchema,
  includedDatasets: z.array(datasetNameSchema),
  rowCounts: rowCountsSchema,
  datasets: v2DatasetRowsSchema,
  integrity: z.object({
    algorithm: z.literal("sha256"),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
}).strict();

const legacySettingRowSchema = z.object({
  id: idSchema,
  key: z.string(),
  value: z.string(),
});

export type BackupDatasets = z.infer<typeof datasetRowsSchema>;
export type BackupSnapshot = z.infer<typeof v2SnapshotSchema>;

export interface ParsedBackup {
  formatVersion: 1 | 2;
  createdAt: Date | null;
  includedDatasets: BackupDatasetName[];
  rowCounts: Record<BackupDatasetName, number>;
  datasets: BackupDatasets;
  integrityValid: boolean | null;
}

export interface BackupDescriptor {
  formatVersion: 1 | 2 | null;
  restorable: boolean;
  includedDatasets: BackupDatasetName[];
  rowCounts: Partial<Record<BackupDatasetName, number>>;
  integrityValid: boolean | null;
}

export interface BackupRestoreAdapter {
  upsert(dataset: BackupDatasetName, rows: readonly unknown[]): Promise<void>;
}

export const BACKUP_RESTORE_CONFIRMATION = "RESTORE BACKUP";

export function isBackupSettingKey(key: string): key is (typeof PUBLIC_BACKUP_SETTING_KEYS)[number] {
  return (PUBLIC_BACKUP_SETTING_KEYS as readonly string[]).includes(key);
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function digestSnapshotPayload(payload: Omit<BackupSnapshot, "integrity"> | Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

function getCounts(datasets: BackupDatasets): Record<BackupDatasetName, number> {
  return Object.fromEntries(BACKUP_DATASET_NAMES.map((name) => [name, datasets[name].length])) as Record<BackupDatasetName, number>;
}

function hasUniqueRows(datasets: BackupDatasets): boolean {
  const unique = <T>(values: T[]) => new Set(values).size === values.length;
  return (
    BACKUP_DATASET_NAMES.every((name) => unique(datasets[name].map((row) => row.id))) &&
    unique(datasets.categories.map((row) => row.slug)) &&
    unique(datasets.settings.map((row) => row.key))
  );
}

export function createBackupSnapshot(source: {
  poems: readonly unknown[];
  poets: readonly unknown[];
  videos: readonly unknown[];
  categories: readonly unknown[];
  settings: readonly unknown[];
  tools: readonly unknown[];
}, createdAt = new Date()): BackupSnapshot {
  const safeSettings = source.settings.filter((row) => {
    if (!row || typeof row !== "object") return false;
    return isBackupSettingKey(String((row as { key?: unknown }).key ?? ""));
  });

  const cleanPoems = source.poems.map((row) => {
    if (!row || typeof row !== "object") return row;
    const { likes: _likes, views: _views, shares: _shares, ...content } = row as Record<string, unknown>;
    return content;
  });

  const parsedDatasets = datasetRowsSchema.safeParse({
    poems: cleanPoems,
    poets: source.poets,
    videos: source.videos,
    categories: source.categories,
    settings: safeSettings,
    tools: source.tools,
  });
  if (!parsedDatasets.success || !hasUniqueRows(parsedDatasets.data)) {
    throw new Error("The current application data could not be validated for backup.");
  }

  const payload = {
    schemaVersion: 2 as const,
    createdAt,
    includedDatasets: [...BACKUP_DATASET_NAMES],
    rowCounts: getCounts(parsedDatasets.data),
    datasets: parsedDatasets.data,
  };
  return {
    ...payload,
    integrity: {
      algorithm: "sha256",
      digest: digestSnapshotPayload(payload),
    },
  };
}

function emptyDatasets(): BackupDatasets {
  return { poems: [], poets: [], videos: [], categories: [], settings: [], tools: [] };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseLegacyBackup(raw: Record<string, unknown>): ParsedBackup | null {
  const legacyCore = z.object({
    poems: z.array(poemRowSchema),
    poets: z.array(poetRowSchema),
    videos: z.array(videoRowSchema),
    categories: z.array(categoryRowSchema),
    timestamp: z.string().optional(),
  }).safeParse(raw);
  if (!legacyCore.success) return null;

  const datasets = emptyDatasets();
  datasets.poems = legacyCore.data.poems;
  datasets.poets = legacyCore.data.poets;
  datasets.videos = legacyCore.data.videos;
  datasets.categories = legacyCore.data.categories;

  let includesLegacySettings = false;
  if (raw.settings !== undefined) {
    if (!Array.isArray(raw.settings)) return null;
    const settingsResult = z.array(legacySettingRowSchema).safeParse(raw.settings);
    if (!settingsResult.success) return null;
    includesLegacySettings = true;
    datasets.settings = settingsResult.data
      .filter((row): row is typeof row & { key: PublicBackupSettingKey } => isBackupSettingKey(row.key))
      .map((row) => ({ ...row, key: row.key }));
  }

  if (!hasUniqueRows(datasets)) return null;
  const timestamp = legacyCore.data.timestamp ? dateSchema.safeParse(legacyCore.data.timestamp) : null;
  return {
    formatVersion: 1,
    createdAt: timestamp?.success ? timestamp.data : null,
    includedDatasets: BACKUP_DATASET_NAMES.filter((name) =>
      name !== "tools" && (name !== "settings" || includesLegacySettings),
    ),
    rowCounts: getCounts(datasets),
    datasets,
    integrityValid: null,
  };
}

export function parseBackupData(data: string): ParsedBackup | null {
  let rawValue: unknown;
  try {
    rawValue = JSON.parse(data);
  } catch {
    return null;
  }
  const raw = asRecord(rawValue);
  if (!raw) return null;

  if (raw.schemaVersion === undefined) return parseLegacyBackup(raw);

  const parsed = v2SnapshotSchema.safeParse(raw);
  if (!parsed.success) return null;
  const expectedNames = [...BACKUP_DATASET_NAMES];
  if (
    parsed.data.includedDatasets.length !== expectedNames.length ||
    new Set(parsed.data.includedDatasets).size !== expectedNames.length ||
    expectedNames.some((name) => !parsed.data.includedDatasets.includes(name))
  ) return null;

  const counts = getCounts(parsed.data.datasets);
  if (BACKUP_DATASET_NAMES.some((name) => parsed.data.rowCounts[name] !== counts[name])) return null;
  if (!hasUniqueRows(parsed.data.datasets)) return null;

  const {
    integrity: _integrity,
    ...payload
  } = raw as Record<string, unknown> & { integrity: unknown };
  const digest = digestSnapshotPayload(payload);
  if (digest !== parsed.data.integrity.digest) return null;

  return {
    formatVersion: 2,
    createdAt: parsed.data.createdAt,
    includedDatasets: [...BACKUP_DATASET_NAMES],
    rowCounts: counts,
    datasets: parsed.data.datasets,
    integrityValid: true,
  };
}

export function describeBackupData(data: string): BackupDescriptor {
  const parsed = parseBackupData(data);
  if (!parsed) {
    return {
      formatVersion: null,
      restorable: false,
      includedDatasets: [],
      rowCounts: {},
      integrityValid: false,
    };
  }
  return {
    formatVersion: parsed.formatVersion,
    restorable: true,
    includedDatasets: parsed.includedDatasets,
    rowCounts: parsed.rowCounts,
    integrityValid: parsed.integrityValid,
  };
}

export function hasRestoreConfirmation(input: unknown, expectedBackupId: number): boolean {
  const confirmationSchema = z.object({
    backupId: idSchema,
    confirmationPhrase: z.literal(BACKUP_RESTORE_CONFIRMATION),
  }).strict();
  const parsed = confirmationSchema.safeParse(input);
  return parsed.success && parsed.data.backupId === expectedBackupId;
}

export async function mergeBackupDatasets(
  adapter: BackupRestoreAdapter,
  datasets: BackupDatasets,
): Promise<void> {
  for (const name of BACKUP_DATASET_NAMES) {
    await adapter.upsert(name, datasets[name]);
  }
}
