export interface Migration {
  version: number;
  description: string;
  sql: string;
}

export const migrations: readonly Migration[] = [
  {
    version: 1,
    description: "initial public and user data separation",
    sql: `
      CREATE TABLE content_releases (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL,
        manifest_sha256 TEXT NOT NULL CHECK(length(manifest_sha256) = 64)
      ) STRICT;

      CREATE TABLE public_entities (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        name TEXT NOT NULL,
        payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
        content_version TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX public_entities_type_name
        ON public_entities(entity_type, name);

      CREATE TABLE user_item_state (
        entity_id TEXT PRIMARY KEY,
        market_price INTEGER CHECK(market_price IS NULL OR market_price >= 0),
        focused INTEGER CHECK(focused IS NULL OR focused IN (0, 1)),
        acquisition_mode TEXT CHECK(
          acquisition_mode IS NULL OR acquisition_mode IN ('craft', 'purchase')
        ),
        payload_json TEXT CHECK(payload_json IS NULL OR json_valid(payload_json)),
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE user_recipe_choices (
        product_entity_id TEXT NOT NULL,
        ingredient_entity_id TEXT NOT NULL,
        acquisition_mode TEXT NOT NULL CHECK(
          acquisition_mode IN ('craft', 'purchase')
        ),
        quantity_override REAL CHECK(
          quantity_override IS NULL OR quantity_override > 0
        ),
        updated_at TEXT NOT NULL,
        PRIMARY KEY (product_entity_id, ingredient_entity_id)
      ) STRICT;

      CREATE TABLE user_entities (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        name TEXT NOT NULL,
        payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX user_entities_type_name
        ON user_entities(entity_type, name);

      CREATE TABLE cookbook_unlocks (
        recipe_id TEXT PRIMARY KEY,
        unlocked INTEGER NOT NULL CHECK(unlocked IN (0, 1)),
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE saved_plans (
        id TEXT PRIMARY KEY,
        plan_type TEXT NOT NULL,
        name TEXT NOT NULL,
        payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX saved_plans_type_updated
        ON saved_plans(plan_type, updated_at DESC);

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL CHECK(json_valid(value_json)),
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE backup_history (
        id TEXT PRIMARY KEY,
        backup_type TEXT NOT NULL CHECK(
          backup_type IN ('daily', 'weekly', 'upgrade', 'manual', 'pre-import')
        ),
        file_name TEXT NOT NULL,
        sha256 TEXT NOT NULL CHECK(length(sha256) = 64),
        size_bytes INTEGER NOT NULL CHECK(size_bytes >= 0),
        created_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('available', 'missing', 'invalid'))
      ) STRICT;

      CREATE INDEX backup_history_created
        ON backup_history(created_at DESC);
    `,
  },
];
