import { afterEach, describe, expect, it } from "vitest";

import {
  migrateDatabase,
  openDatabase,
  type SqliteDatabase,
} from "./sqlite-database.js";

let database: SqliteDatabase | undefined;

afterEach(() => {
  database?.close();
  database = undefined;
});

describe("database migrations", () => {
  it("creates the initial schema and is idempotent", () => {
    database = openDatabase(":memory:");

    expect(migrateDatabase(database)).toBe(1);
    expect(migrateDatabase(database)).toBe(1);

    const tables = database
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);
    expect(tables).toEqual([
      "backup_history",
      "content_releases",
      "cookbook_unlocks",
      "public_entities",
      "saved_plans",
      "settings",
      "user_entities",
      "user_item_state",
      "user_recipe_choices",
    ]);
  });

  it("keeps personal state when public content is replaced", () => {
    database = openDatabase(":memory:");
    migrateDatabase(database);
    const now = "2026-07-11T10:00:00+08:00";

    database
      .prepare(
        `INSERT INTO public_entities
          (id, entity_type, name, payload_json, content_version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run("item.iron-ore", "market-item", "铁矿", "{}", "2026.07.11.1", now);
    database
      .prepare(
        `INSERT INTO user_item_state
          (entity_id, market_price, focused, acquisition_mode, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run("item.iron-ore", 321, 1, "purchase", now);

    database
      .prepare(
        `UPDATE public_entities
         SET name = ?, payload_json = ?, content_version = ?
         WHERE id = ?`,
      )
      .run("铁矿（更新）", '{"level":2}', "2026.07.12.1", "item.iron-ore");

    expect(
      database
        .prepare("SELECT market_price, focused, acquisition_mode FROM user_item_state")
        .get(),
    ).toEqual({ market_price: 321, focused: 1, acquisition_mode: "purchase" });
  });

  it("rejects invalid JSON and invalid personal values", () => {
    database = openDatabase(":memory:");
    migrateDatabase(database);

    expect(() =>
      database!
        .prepare(
          `INSERT INTO settings (key, value_json, updated_at)
           VALUES ('theme', 'not-json', '2026-07-11T10:00:00+08:00')`,
        )
        .run(),
    ).toThrow();
    expect(() =>
      database!
        .prepare(
          `INSERT INTO user_item_state
            (entity_id, market_price, updated_at)
           VALUES ('item.test', -1, '2026-07-11T10:00:00+08:00')`,
        )
        .run(),
    ).toThrow();
  });
});
