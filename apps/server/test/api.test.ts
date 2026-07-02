import { afterAll, describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { Etag, HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { SqlClient } from "effect/unstable/sql";
import { BunHttpPlatform, BunServices } from "@effect/platform-bun";
import { api, AuthMiddleware, CurrentUser } from "@sparstrategi/contract";
import { defaultScenarioInput } from "@sparstrategi/engine";

// Import the handler group + repo from http.ts — restructure http.ts if needed so
// ScenariosHandlers is exported for tests.
import { ScenariosHandlers } from "../src/http";
import { ScenarioRepoLive } from "../src/scenario-repo";

const TestSql = SqliteClient.layer({ filename: ":memory:" });

const TestDbInit = Layer.effectDiscard(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE IF NOT EXISTS scenario (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
      input_json TEXT NOT NULL, engine_version INTEGER NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`;
  }),
);

const FakeAuth = Layer.succeed(AuthMiddleware)(
  Effect.fnUntraced(function* (httpEffect) {
    return yield* Effect.provideService(httpEffect, CurrentUser, {
      id: "test-user",
      email: "test@example.com",
    });
  }),
);

const TestApi = HttpApiBuilder.layer(api).pipe(
  Layer.provide(ScenariosHandlers),
  Layer.provide(FakeAuth),
  HttpRouter.provideRequest(ScenarioRepoLive),
  Layer.provide(TestDbInit),
  Layer.provide(TestSql),
  Layer.provide(Etag.layer),
  Layer.provide(BunHttpPlatform.layer),
  Layer.provide(BunServices.layer),
);

const { handler, dispose } = HttpRouter.toWebHandler(TestApi);
afterAll(() => dispose());

describe("scenario API", () => {
  test("create → list → update → delete", async () => {
    const created = await handler(
      new Request("http://test/api/scenarios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Bas", input: defaultScenarioInput }),
      }),
    );
    expect(created.status).toBe(200);
    const scenario = (await created.json()) as { id: string; name: string };
    expect(scenario.name).toBe("Bas");

    const list = await handler(new Request("http://test/api/scenarios"));
    expect(list.status).toBe(200);
    expect(((await list.json()) as unknown[]).length).toBe(1);

    const updated = await handler(
      new Request(`http://test/api/scenarios/${scenario.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Bas 2", input: defaultScenarioInput }),
      }),
    );
    expect(updated.status).toBe(200);

    const removed = await handler(
      new Request(`http://test/api/scenarios/${scenario.id}`, { method: "DELETE" }),
    );
    expect(removed.status).toBe(204);

    const missing = await handler(
      new Request(`http://test/api/scenarios/${scenario.id}`, { method: "DELETE" }),
    );
    expect(missing.status).toBe(404);
  });

  test("invalid payload → 400", async () => {
    const res = await handler(
      new Request("http://test/api/scenarios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: 42 }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
