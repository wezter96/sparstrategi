import { existsSync } from "node:fs";
import { config } from "dotenv";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const candidatePaths = [
  `${process.cwd()}/.env`,
  `${process.cwd()}/apps/server/.env`,
];
const envPath = candidatePaths.find((path) => existsSync(path));

config(envPath ? { path: envPath } : undefined);

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
