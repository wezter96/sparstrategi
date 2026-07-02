import { Context, Schema } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiMiddleware,
} from "effect/unstable/httpapi";
import { ScenarioInput } from "@sparstrategi/engine";

export const Scenario = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  input: ScenarioInput,
  engineVersion: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type Scenario = typeof Scenario.Type;

export const ScenarioUpsert = Schema.Struct({
  name: Schema.String,
  input: ScenarioInput,
});
export type ScenarioUpsert = typeof ScenarioUpsert.Type;

export interface CurrentUserShape {
  readonly id: string;
  readonly email: string;
}
export class CurrentUser extends Context.Service<CurrentUser, CurrentUserShape>()(
  "CurrentUser",
) {}

export class AuthMiddleware extends HttpApiMiddleware.Service<
  AuthMiddleware,
  { provides: CurrentUser }
>()("AuthMiddleware", { error: HttpApiError.Unauthorized }) {}

const scenarios = HttpApiGroup.make("scenarios")
  .add(
    HttpApiEndpoint.get("list", "/scenarios", {
      success: Schema.Array(Scenario),
    }),
    HttpApiEndpoint.post("create", "/scenarios", {
      payload: ScenarioUpsert,
      success: Scenario,
    }),
    HttpApiEndpoint.put("update", "/scenarios/:id", {
      params: { id: Schema.String },
      payload: ScenarioUpsert,
      success: Scenario,
      error: HttpApiError.NotFound,
    }),
    HttpApiEndpoint.delete("remove", "/scenarios/:id", {
      params: { id: Schema.String },
      error: HttpApiError.NotFound,
    }),
  )
  .middleware(AuthMiddleware);

export const api = HttpApi.make("sparstrategi").add(scenarios).prefix("/api");
