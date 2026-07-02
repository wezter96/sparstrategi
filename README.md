# sparstrategi

A Swedish savings-strategy simulator built with Effect v4 beta, Bun, and TanStack Router.

## Quick Start

### First-Time Setup

Follow these steps in order:

1. Install dependencies:
   ```bash
   bun install
   ```

2. Configure environment variables:
   - **Server** (`apps/server/.env`): Set `DATABASE_URL=../../local.db`
   - **Web** (`apps/web/.env`): Set `VITE_SERVER_URL=http://localhost:3000`

   The files should already exist with these values, so verify they match.

3. Run database migrations (first time only):
   ```bash
   cd packages/auth
   bun run auth:migrate
   ```

4. Start the development server:
   ```bash
   bun run dev
   ```

   **Note:** The server listens on port 3000. If that port is occupied, either:
   - Stop the other process, or
   - Adjust `apps/server/src/index.ts` to use a different port

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

See the `/docs` directory for detailed requirements and design specifications.
