/// <reference types="bun" />
import { Database } from "bun:sqlite";
import { env } from "@sparstrategi/env/server";
import { betterAuth } from "better-auth";

export function createAuth() {
  return betterAuth({
    database: new Database(env.DATABASE_URL),
    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [],
  });
}

export const auth = createAuth();
