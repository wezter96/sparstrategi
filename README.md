# sparstrategi

A Swedish savings-strategy simulator built with Effect v4 beta, Bun, and TanStack Router.

## Quick Start

### First-Time Setup

Follow these steps in order:

1. Install dependencies:
   ```bash
   bun install
   ```

2. Configure environment variables. These files are gitignored (`.env`) — on a fresh clone
   they do **not** exist yet, so you must create them yourself.

   Create `apps/server/.env`:
   ```bash
   DATABASE_URL=../../local.db
   BETTER_AUTH_SECRET=<32+ char random string>
   BETTER_AUTH_URL=http://localhost:3000
   CORS_ORIGIN=http://localhost:5173
   NODE_ENV=development
   ```

   Create `apps/web/.env`:
   ```bash
   VITE_SERVER_URL=http://localhost:3000
   ```

   Generate a secret for `BETTER_AUTH_SECRET` with e.g. `openssl rand -base64 32`.

3. Run database migrations (first time only):
   ```bash
   cd packages/auth
   bun run auth:migrate
   ```

4. Start the development server:
   ```bash
   bun run dev
   ```

   **Note:** The server listens on port 3000 by default. If that port is occupied, set the
   `PORT` env var instead of editing source, and keep both `.env` files in sync:
   ```bash
   # apps/server
   PORT=3001 bun run dev
   ```
   Then update `apps/web/.env`'s `VITE_SERVER_URL` and `apps/server/.env`'s `BETTER_AUTH_URL`
   to match the new port (e.g. `http://localhost:3001`).

The development server will start both the web app (usually on a separate port via TanStack Router) and the API server.

## Commands

- `bun install` – Install dependencies
- `bun run dev` – Start development server
- `bun test` – Run tests across all workspaces
- `bun run check-types` – Type-check all code
- `bun run build` – Build all apps and packages

## Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Effects & Async**: [Effect](https://effect.website) v4 beta
- **Routing (Web)**: [TanStack Router](https://tanstack.com/router)
- **Styling**: Tailwind CSS
- **Database**: SQLite with Drizzle ORM
- **Auth**: Better Auth

## Project Structure

```
apps/
  ├── server/    – Effect-based API server
  └── web/       – TanStack Router SPA
packages/
  ├── auth/      – Auth configuration and migrations
  ├── contract/  – Domain models
  ├── engine/    – Business logic
  ├── env/       – Environment configuration (Zod schemas)
  ├── ui/        – Shared React components
  └── config/    – TypeScript/linting configuration
```

## Spec

See `docs/superpowers/specs/2026-07-02-sparstrategi-simulator-design.md` for the detailed
requirements and design specification.
