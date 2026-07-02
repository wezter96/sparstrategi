import { Effect, Layer } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiError } from "effect/unstable/httpapi";
import { AuthMiddleware, CurrentUser } from "@sparstrategi/contract";
import { auth } from "@sparstrategi/auth";

const toHeaders = (raw: Record<string, string | ReadonlyArray<string> | undefined>) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  return headers;
};

export const AuthMiddlewareLive = Layer.succeed(AuthMiddleware)(
  Effect.fnUntraced(function* (httpEffect) {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const session = yield* Effect.promise(() =>
      auth.api.getSession({ headers: toHeaders(request.headers) }),
    );
    if (!session) {
      return yield* new HttpApiError.Unauthorized();
    }
    return yield* Effect.provideService(httpEffect, CurrentUser, {
      id: session.user.id,
      email: session.user.email,
    });
  }),
);
