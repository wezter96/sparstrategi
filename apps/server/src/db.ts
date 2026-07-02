import { Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { env } from "@sparstrategi/env/server";

export const SqlLive = SqliteClient.layer({ filename: env.DATABASE_URL });

/** Drizzle table definition — single source of truth for queries. */
export const scenarioTable = sqliteTable("scenario", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  inputJson: text("input_json").notNull(),
  engineVersion: integer("engine_version").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

const createTables = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE IF NOT EXISTS scenario (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      input_json TEXT NOT NULL,
      engine_version INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
  yield* sql`CREATE INDEX IF NOT EXISTS scenario_user_idx ON scenario (user_id)`;
});

/** Side-effect layer: ensures app tables exist. */
export const DbInit = Layer.effectDiscard(createTables);
