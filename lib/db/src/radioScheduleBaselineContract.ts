export type ColumnContract = {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
};

export type Pre0004ColumnContract = Record<string, Record<string, ColumnContract>>;

const typeNames: Record<string, string> = {
  SERIAL: "int4", INTEGER: "int4", INT: "int4", BIGINT: "int8",
  TEXT: "text", BOOLEAN: "bool", REAL: "float4", JSONB: "jsonb",
  TIMESTAMPTZ: "timestamptz", TIMESTAMP: "timestamp",
};

function normalizeDefault(value: string | null): string | null {
  if (value === null) return null;
  return value.trim().toLowerCase().replace(/::(?:text|character varying|integer|int4|boolean|bool|regclass)\b/g, "")
    .replace(/^'([^']*)'$/, "$1");
}

/** Parse only the deliberately simple CREATE TABLE / ADD COLUMN grammar used by these reviewed SQL files. */
export function buildPre0004ColumnContract(
  baseline: string,
  migrations: [string, string, string],
): Pre0004ColumnContract {
  const contract: Pre0004ColumnContract = {};
  const sources = [baseline, migrations[0]];
  for (const source of sources) {
    const tablePattern = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\);/gi;
    for (const match of source.matchAll(tablePattern)) {
      const [, table, body] = match;
      if (contract[table]) throw new Error(`Duplicate table definition in baseline/migrations: ${table}`);
      contract[table] = {};
      for (const rawLine of body.split("\n")) {
        const line = rawLine.replace(/--.*$/, "").trim().replace(/,$/, "");
        if (/^(REFERENCES|CONSTRAINT|UNIQUE|PRIMARY|FOREIGN|CHECK)\b/i.test(line)) continue;
        const field = /^([a-z_][a-z0-9_]*)\s+([A-Z]+)([\s\S]*)$/i.exec(line);
        if (!field) continue;
        const [, name, declaredType, tail] = field;
        const type = typeNames[declaredType.toUpperCase()];
        if (!type) throw new Error(`Unsupported column type in migration contract: ${table}.${name}`);
        const defaultMatch = /\bDEFAULT\s+(.+?)(?=\s+(?:NOT\s+NULL|PRIMARY\s+KEY|REFERENCES|UNIQUE|CHECK)\b|$)/i.exec(tail);
        contract[table][name] = {
          name,
          type,
          nullable: !/\bNOT\s+NULL\b|\bPRIMARY\s+KEY\b/i.test(tail),
          defaultValue: declaredType.toUpperCase() === "SERIAL"
            ? "<serial>"
            : normalizeDefault(defaultMatch?.[1]?.replace(/;$/, "").trim() ?? null),
        };
      }
    }
  }
  const category = /\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?radio_audio\s+ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+category\s+TEXT\b/i.test(migrations[1]);
  const berlin = /\bALTER\s+TABLE(?:\s+IF\s+EXISTS)?\s+radio_schedules\s+ALTER\s+COLUMN\s+timezone\s+SET\s+DEFAULT\s+'Europe\/Berlin'/i.test(migrations[2]);
  if (!category || !berlin || !contract.radio_audio || !contract.radio_schedules?.timezone) {
    throw new Error("Radio migration contract is missing the expected category or timezone change.");
  }
  contract.radio_audio.category = { name: "category", type: "text", nullable: true, defaultValue: null };
  contract.radio_schedules.timezone.defaultValue = "europe/berlin";

  for (const table of PRE_0004_TABLES) {
    const actual = Object.keys(contract[table] ?? {}).sort();
    const expected = [...(PRE_0004_COLUMNS[table] ?? [])].sort();
    if (actual.length !== expected.length || actual.some((column, index) => column !== expected[index])) {
      throw new Error(`Baseline/migration column inventory does not match the reviewed contract for ${table}.`);
    }
  }
  if (Object.keys(contract).some((table) => !PRE_0004_TABLES.includes(table))) {
    throw new Error("Baseline/migrations contain an unexpected table.");
  }
  return contract;
}

// This is intentionally a separate contract from the 0004 integration test.
// Column lists and key/index names are pinned to the proposed baseline and
// migrations 0001–0003. Defaults for the changed schedule/category fields are
// checked explicitly below.
const tableColumns: Record<string, string> = {
  admin_users: "id email password_hash role name status last_login_at notes activation_pending_at token_revoked_at created_at",
  poets: "id name name_urdu bio bio_urdu era",
  poems: "id title title_urdu content poet_name poet_name_urdu category category_urdu featured image_url likes views shares visual_poetry language status created_by_user_id approved_by_user_id approved_at rejected_by_user_id rejected_at rejection_reason created_at updated_at",
  audit_logs: "id actor_user_id action target_type target_id metadata created_at",
  radio_audio: "id title title_urdu description original_filename object_key upload_session_id processed_object_key object_version sha256 size_bytes duration_ms container codec bitrate_kbps sample_rate_hz channels integrated_lufs true_peak_db normalization_status processing_status editorial_status rights_status rights_notes rights_valid_from rights_valid_until poet_id poem_id created_by_user_id approved_by_user_id approved_at rejected_by_user_id rejected_at rejection_reason archived_at created_at updated_at category",
  radio_playlists: "id name description mode status repeat_window is_default is_fallback created_by_user_id updated_by_user_id version archived_at created_at updated_at",
  radio_playlist_items: "id playlist_id audio_id position weight enabled cue_in_ms cue_out_ms attribution created_at updated_at",
  radio_schedules: "id name playlist_id status timezone days_of_week start_local_time end_local_time effective_from effective_until priority program_name version attribution created_by_user_id updated_by_user_id created_at updated_at",
  radio_settings: "id key value created_at updated_at",
  radio_play_history: "id audio_id playlist_id schedule_id manifest_version started_at ended_at expected_duration_ms actual_duration_ms result failure_code metadata created_at",
  radio_manifests: "id version status payload sha256 published_by_user_id published_at created_at",
};

export const PRE_0004_TABLES = Object.keys(tableColumns);
export const PRE_0004_COLUMNS = Object.fromEntries(
  Object.entries(tableColumns).map(([table, names]) => [table, names.split(" ")]),
);

export const PRE_0004_REQUIRED_OBJECTS = [
  "admin_users_pkey", "admin_users_email_key", "idx_admin_users_role_status",
  "poets_pkey", "poems_pkey", "idx_poems_status", "idx_poems_created_by",
  "idx_poems_public_latest", "audit_logs_pkey", "idx_audit_logs_actor",
  "idx_audit_logs_created", "radio_audio_pkey", "radio_playlists_pkey",
  "radio_playlist_items_pkey", "uq_radio_playlist_item_position",
  "radio_schedules_pkey", "radio_settings_pkey", "radio_settings_key_key",
  "radio_play_history_pkey", "radio_manifests_pkey", "radio_manifests_version_key",
  "idx_radio_audio_editorial_status", "idx_radio_audio_processing_status",
  "idx_radio_audio_rights_status", "idx_radio_audio_created_at",
  "idx_radio_audio_poem_id", "idx_radio_audio_category",
  "idx_radio_playlists_status", "idx_radio_playlists_fallback",
  "idx_radio_playlist_items_audio", "idx_radio_schedules_status",
  "idx_radio_schedules_effective", "idx_radio_play_history_started_at",
  "idx_radio_play_history_audio", "idx_radio_manifests_status",
];

export type SchemaSnapshot = {
  tables: string[];
  columns: Array<{ table: string; column: string; type: string; nullable: boolean; defaultValue: string | null }>;
  objects: string[];
  foreignKeys: string[];
  settings: Array<{ table: string; column: string; nullable: boolean; defaultValue: string | null }>;
};

export function verifyPre0004Schema(snapshot: SchemaSnapshot, contract?: Pre0004ColumnContract): string[] {
  const errors: string[] = [];
  const actualTables = new Set(snapshot.tables);
  for (const table of actualTables) {
    if (!PRE_0004_TABLES.includes(table)) errors.push(`unexpected table ${table}`);
  }
  for (const table of PRE_0004_TABLES) {
    if (!actualTables.has(table)) errors.push(`missing table ${table}`);
  }
  for (const [table, names] of Object.entries(PRE_0004_COLUMNS)) {
    for (const name of names) {
      if (!snapshot.columns.some((c) => c.table === table && c.column === name)) {
        errors.push(`missing column ${table}.${name}`);
      }
    }
    for (const column of snapshot.columns.filter((c) => c.table === table)) {
      if (!names.includes(column.column)) errors.push(`unexpected column ${table}.${column.column}`);
      const expected = contract?.[table]?.[column.column];
      if (expected) {
        const defaultMatches = expected.defaultValue === "<serial>"
          ? column.defaultValue?.toLowerCase().startsWith("nextval(") === true
          : normalizeDefault(column.defaultValue) === expected.defaultValue;
        if (column.type !== expected.type || column.nullable !== expected.nullable || !defaultMatches) {
          errors.push(`column metadata mismatch ${table}.${column.column}`);
        }
      }
    }
  }
  const actualObjects = new Set(snapshot.objects);
  for (const name of PRE_0004_REQUIRED_OBJECTS) {
    if (!actualObjects.has(name)) errors.push(`missing constraint or index ${name}`);
  }
  const expectedForeignKeys = [
    "poems.created_by_user_id>admin_users.id:SET NULL",
    "poems.approved_by_user_id>admin_users.id:SET NULL",
    "poems.rejected_by_user_id>admin_users.id:SET NULL",
    "audit_logs.actor_user_id>admin_users.id:SET NULL",
    "radio_audio.poet_id>poets.id:SET NULL", "radio_audio.poem_id>poems.id:SET NULL",
    "radio_audio.created_by_user_id>admin_users.id:SET NULL",
    "radio_audio.approved_by_user_id>admin_users.id:SET NULL",
    "radio_audio.rejected_by_user_id>admin_users.id:SET NULL",
    "radio_playlists.created_by_user_id>admin_users.id:SET NULL",
    "radio_playlists.updated_by_user_id>admin_users.id:SET NULL",
    "radio_playlist_items.playlist_id>radio_playlists.id:CASCADE",
    "radio_playlist_items.audio_id>radio_audio.id:RESTRICT",
    "radio_schedules.playlist_id>radio_playlists.id:RESTRICT",
    "radio_schedules.created_by_user_id>admin_users.id:SET NULL",
    "radio_schedules.updated_by_user_id>admin_users.id:SET NULL",
    "radio_play_history.audio_id>radio_audio.id:SET NULL",
    "radio_play_history.playlist_id>radio_playlists.id:SET NULL",
    "radio_play_history.schedule_id>radio_schedules.id:SET NULL",
    "radio_manifests.published_by_user_id>admin_users.id:SET NULL",
  ];
  const actualForeignKeys = new Set(snapshot.foreignKeys);
  for (const key of expectedForeignKeys) {
    if (!actualForeignKeys.has(key)) errors.push(`missing foreign key ${key}`);
  }
  const setting = (table: string, column: string) =>
    snapshot.settings.find((item) => item.table === table && item.column === column);
  const category = setting("radio_audio", "category");
  if (!category || category.nullable !== true || category.defaultValue !== null) {
    errors.push("radio_audio.category must be nullable text without a default");
  }
  const timezone = setting("radio_schedules", "timezone");
  if (!timezone?.defaultValue?.includes("Europe/Berlin")) {
    errors.push("radio_schedules.timezone must default to Europe/Berlin");
  }
  if (timezone?.nullable !== false) errors.push("radio_schedules.timezone must be NOT NULL");
  if (snapshot.columns.some((c) => c.table === "radio_schedules" && c.column === "title_en")) {
    errors.push("radio_schedules.title_en must be absent before migration 0004");
  }
  return errors;
}
