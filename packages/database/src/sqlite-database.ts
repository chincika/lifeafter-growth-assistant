import { DatabaseSync } from "node:sqlite";

import { migrations } from "./migrations.js";

export interface OpenDatabaseOptions {
  readonly?: boolean;
}

export type SqliteDatabase = DatabaseSync;

export function openDatabase(
  filePath: string,
  options: OpenDatabaseOptions = {},
): SqliteDatabase {
  const database = new DatabaseSync(filePath, {
    readOnly: options.readonly ?? false,
  });
  database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (!options.readonly && filePath !== ":memory:") {
    database.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
  }
  return database;
}

export function migrateDatabase(database: SqliteDatabase): number {
  const currentVersion = getUserVersion(database);
  const pending = migrations.filter((migration) => migration.version > currentVersion);

  for (const migration of pending) {
    if (migration.version !== currentVersion + pending.indexOf(migration) + 1) {
      throw new Error(`Non-contiguous database migration: ${migration.version}`);
    }

    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(migration.sql);
      database.exec(`PRAGMA user_version = ${migration.version}`);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  return getUserVersion(database);
}

function getUserVersion(database: SqliteDatabase): number {
  const row = database.prepare("PRAGMA user_version").get() as
    | { user_version: number }
    | undefined;
  if (!row) throw new Error("Unable to read SQLite user_version");
  return row.user_version;
}
