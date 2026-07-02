import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { api, CurrentUser } from "@sparstrategi/contract";
import { auth } from "@sparstrategi/auth";
import { env } from "@sparstrategi/env/server";
import { DbInit, SqlLive } from "./db";
import { AuthMiddlewareLive } from "./auth-middleware";
import { ScenarioRepo, ScenarioRepoLive } from "./scenario-repo";

export const ScenariosHandlers = HttpApiBuilder.group(api, "scenarios", (handlers) =>
  handlers
    .handle("list", () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        const repo = yield* ScenarioRepo;
        return yield* repo.list(user.id);
      }),
    )
    .handle("create", ({ payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        const repo = yield* ScenarioRepo;
        return yield* repo.create(user.id, payload);
      }),
    )
    .handle("update", ({ params, payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        const repo = yield* ScenarioRepo;
        const updated = yield* repo.update(user.id, params.id, payload);
        if (updated === null) return yield* new HttpApiError.NotFound();
        return updated;
      }),
    )
    .handle("remove", ({ params }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        const repo = yield* ScenarioRepo;
        const removed = yield* repo.remove(user.id, params.id);
        if (!removed) return yield* new HttpApiError.NotFound();
      }),
    ),
);

const ApiLayer = HttpApiBuilder.layer(api).pipe(
  Layer.provide(ScenariosHandlers),
  Layer.provide(AuthMiddlewareLive),
  HttpRouter.provideRequest(ScenarioRepoLive),
);

const BetterAuthRoute = HttpRouter.add(
  "*",
  "/api/auth/*",
  Effect.fnUntraced(function* (request: HttpServerRequest.HttpServerRequest) {
    const webRequest = yield* HttpServerRequest.toWeb(request);
    const response = yield* Effect.promise(() => auth.handler(webRequest));
    return HttpServerResponse.fromWeb(response);
  }),
);

const HealthRoute = HttpRouter.add("GET", "/", () =>
  Effect.succeed(HttpServerResponse.text("OK")),
);

const CorsLayer = HttpRouter.cors({
  allowedOrigins: [env.CORS_ORIGIN],
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  // Reflect the browser's actual Access-Control-Request-Headers instead of a
  // fixed allowlist: the Effect HttpClient attaches tracing propagation
  // headers (traceparent, tracestate, b3, ...) that vary by instrumentation,
  // and a fixed list would need to be kept in sync with those.
  credentials: true,
});

export { ScenarioRepo, ScenarioRepoLive };

export const AppLayer = Layer.mergeAll(
  ApiLayer,
  BetterAuthRoute,
  HealthRoute,
  CorsLayer,
).pipe(Layer.provide(DbInit), Layer.provide(SqlLive));
