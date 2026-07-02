# Sparstrategi

Swedish investment-strategy simulator (leveraged ISK+AF model, goal evaluation, crash stress tests). Spec: `docs/superpowers/specs/2026-07-02-sparstrategi-simulator-design.md`. Plan: `docs/superpowers/plans/2026-07-02-sparstrategi-simulator.md`.

## Stack

- Bun workspaces + Turborepo. Apps: `apps/web` (React 19, TanStack Router, Tailwind 4), `apps/server` (Effect v4 HttpApi on Bun). Packages: `engine` (pure TS simulation), `contract` (shared HttpApi), `auth` (Better-Auth on bun:sqlite), `ui`, `env`, `config`.
- **Effect v4 beta, pinned exactly:** all `effect*` packages at `4.0.0-beta.93`; `drizzle-orm` at `1.0.0-rc.4` (NOT `1.0.0-rc.4-5d5b77c` — that build strips the Effect SQLite drivers). Version bumps are deliberate, single commits.

## Commands

- `bun install` · `bun run dev` (all) · `bun run dev:server` / `bun run dev:web`
- `bun test` (bun:test, not vitest) · `bun run check-types` · `bun run build`
- First-time DB: `cd packages/auth && bun run auth:migrate`

## Effect v4 gotchas (verified against beta.93 — this repo is v4, most online docs are v3)

- Http lives in core: `effect/unstable/httpapi`, `effect/unstable/http`. Do NOT install `@effect/platform` (v3-only).
- `Context.Service` (no `Context.Tag`, no `Effect.Service`); `Schema.TaggedErrorClass` (not `TaggedError`); `Result` (not `Either`); `Layer.succeed(Key)(value)` and `Layer.effect(Key)(effect)` are curried.
- HttpApi endpoints take an options object (`{ params, payload, success, error }`) — no `.setPayload/.addSuccess` chaining. `HttpApiEndpoint.delete` (not `.del`). Serve via `HttpApiBuilder.layer(api)` + `HttpRouter.serve(...)`; CORS via `HttpRouter.cors(...)`.
- Frontend state: `@effect/atom-react` + `Atom` from `effect/unstable/reactivity`; async atoms yield `AsyncResult` (not `Result`).
- Drizzle Effect integration: `makeWithDefaults()` from `drizzle-orm/effect-sqlite-bun`, requires the `SqliteClient` service from `@effect/sql-sqlite-bun`.
- When unsure about a v4 API, read the installed `.d.ts` under `node_modules/effect/dist/` — do not trust v3 memory.

<!-- effect-solutions:start -->
## Effect Best Practices

**IMPORTANT:** Always consult effect-solutions before writing Effect code.

1. Run `effect-solutions list` to see available guides
2. Run `effect-solutions show <topic>...` for relevant patterns (supports multiple topics)
3. Search `~/.local/share/effect-solutions/effect` for real implementations

Topics: quick-start, project-setup, tsconfig, basics, services-and-layers, data-modeling, error-handling, config, testing, cli.

Never guess at Effect patterns - check the guide first.
<!-- effect-solutions:end -->

## Local Effect Source

The Effect v4 repository is cloned to `~/.local/share/effect-solutions/effect` for reference.
Use this to explore APIs, find usage examples, and understand implementation
details when the documentation isn't enough. Note: effect-solutions guides may
reference `ServiceMap` — beta.93 still uses `effect/Context`; trust the installed types.

## Domain conventions

- Money is SEK (kr) as plain `number`; rates are decimal fractions (0.07 = 7%).
- UI copy in Swedish; numbers via `fmtKr`/`fmtPct` (sv-SE, auto-scale kr/tkr/Mkr/Mdr).
- The engine's document-reproduction test (`packages/engine/test/simulate.test.ts`) is the regression anchor — never weaken its tolerances.
