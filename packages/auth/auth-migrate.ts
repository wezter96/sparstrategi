/**
 * Standalone migration runner for Better-Auth on bun:sqlite.
 *
 * The `@better-auth/cli migrate --config` command loads the TS config via
 * jiti, which resolves imports through Node's CJS module resolver and
 * cannot resolve the `bun:sqlite` built-in (even though the host process is
 * Bun) — it throws `Cannot find module 'bun:sqlite'`. Since `packages/auth`
 * already runs entirely under Bun, we call Better-Auth's own migration
 * primitives (`getMigrations`) directly instead of shelling out to the CLI.
 *
 * Usage: `bun run auth:migrate` (from `packages/auth`). Loads env vars from
 * `apps/server/.env` via `DOTENV_CONFIG_PATH` since this package has no
 * `.env` of its own; `DATABASE_URL` is a relative path resolved against the
 * process cwd, so it lands on the same `local.db` the server uses as long
 * as this script is invoked from a directory two levels below the repo
 * root (both `packages/auth` and `apps/server` qualify).
 */
import { getMigrations } from "better-auth/db/migration";
import { auth } from "./src/index";

const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(
  auth.options,
);

console.log(
  "Tables to create:",
  toBeCreated.map((t) => t.table),
);
console.log(
  "Fields to add:",
  toBeAdded.map((t) => t.table),
);

await runMigrations();

console.log("Better-Auth migration complete.");
