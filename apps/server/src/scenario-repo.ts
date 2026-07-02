import { Context, Effect, Layer, Schema } from "effect";
import { and, desc, eq } from "drizzle-orm";
import { makeWithDefaults } from "drizzle-orm/effect-sqlite-bun";
import { Scenario, ScenarioUpsert } from "@sparstrategi/contract";
import { ENGINE_VERSION, ScenarioInput } from "@sparstrategi/engine";
import { scenarioTable } from "./db";

const decodeInput = Schema.decodeUnknownSync(ScenarioInput);

type ScenarioRow = typeof scenarioTable.$inferSelect;

const rowToScenario = (row: ScenarioRow): Scenario => ({
  id: row.id,
  name: row.name,
  input: decodeInput(JSON.parse(row.inputJson)),
  engineVersion: row.engineVersion,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export interface ScenarioRepoShape {
  readonly list: (userId: string) => Effect.Effect<ReadonlyArray<Scenario>>;
  readonly create: (userId: string, data: ScenarioUpsert) => Effect.Effect<Scenario>;
  readonly update: (
    userId: string,
    id: string,
    data: ScenarioUpsert,
  ) => Effect.Effect<Scenario | null>;
  readonly remove: (userId: string, id: string) => Effect.Effect<boolean>;
}

export class ScenarioRepo extends Context.Service<ScenarioRepo, ScenarioRepoShape>()(
  "ScenarioRepo",
) {}

export const ScenarioRepoLive = Layer.effect(ScenarioRepo)(
  Effect.gen(function* () {
    const db = yield* makeWithDefaults();

    const list: ScenarioRepoShape["list"] = (userId) =>
      db
        .select()
        .from(scenarioTable)
        .where(eq(scenarioTable.userId, userId))
        .orderBy(desc(scenarioTable.updatedAt))
        .pipe(
          Effect.map((rows) => rows.map(rowToScenario)),
          Effect.orDie,
        );

    const create: ScenarioRepoShape["create"] = (userId, data) =>
      Effect.gen(function* () {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        yield* db.insert(scenarioTable).values({
          id,
          userId,
          name: data.name,
          inputJson: JSON.stringify(data.input),
          engineVersion: ENGINE_VERSION,
          createdAt: now,
          updatedAt: now,
        });
        return {
          id,
          name: data.name,
          input: data.input,
          engineVersion: ENGINE_VERSION,
          createdAt: now,
          updatedAt: now,
        } satisfies Scenario;
      }).pipe(Effect.orDie);

    const update: ScenarioRepoShape["update"] = (userId, id, data) =>
      Effect.gen(function* () {
        const now = new Date().toISOString();
        yield* db
          .update(scenarioTable)
          .set({
            name: data.name,
            inputJson: JSON.stringify(data.input),
            engineVersion: ENGINE_VERSION,
            updatedAt: now,
          })
          .where(and(eq(scenarioTable.id, id), eq(scenarioTable.userId, userId)));
        const rows = yield* db
          .select()
          .from(scenarioTable)
          .where(and(eq(scenarioTable.id, id), eq(scenarioTable.userId, userId)));
        return rows.length > 0 ? rowToScenario(rows[0]!) : null;
      }).pipe(Effect.orDie);

    const remove: ScenarioRepoShape["remove"] = (userId, id) =>
      Effect.gen(function* () {
        const existing = yield* db
          .select({ id: scenarioTable.id })
          .from(scenarioTable)
          .where(and(eq(scenarioTable.id, id), eq(scenarioTable.userId, userId)));
        if (existing.length === 0) return false;
        yield* db
          .delete(scenarioTable)
          .where(and(eq(scenarioTable.id, id), eq(scenarioTable.userId, userId)));
        return true;
      }).pipe(Effect.orDie);

    return { list, create, update, remove } satisfies ScenarioRepoShape;
  }),
);
