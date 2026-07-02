import { api } from "@sparstrategi/contract";
import { env } from "@sparstrategi/env/web";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { AtomHttpApi } from "effect/unstable/reactivity";

export class ApiClient extends AtomHttpApi.Service<ApiClient>()("ApiClient", {
  api,
  baseUrl: env.VITE_SERVER_URL,
  httpClient: FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.RequestInit)({ credentials: "include" })),
  ),
}) {}

export const scenariosAtom = ApiClient.query("scenarios", "list", {
  reactivityKeys: ["scenarios"],
});
export const createScenarioAtom = ApiClient.mutation("scenarios", "create");
export const updateScenarioAtom = ApiClient.mutation("scenarios", "update");
export const removeScenarioAtom = ApiClient.mutation("scenarios", "remove");
