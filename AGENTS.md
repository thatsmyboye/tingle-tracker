# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

Turborepo + pnpm monorepo. See `CLAUDE.md` for full conventions and `README.md` for local dev setup steps.

### Key services for local development

| Service | How to start | Notes |
|---|---|---|
| Supabase (local) | `supabase start` then `supabase db reset` | Requires Docker. Runs Postgres on 54322, API on 54321, Studio on 54323 |
| Next.js web app | `pnpm --filter web dev` | Runs on `http://localhost:3000`. Env file: `apps/web/.env.local` |
| Inngest dev server | `npx inngest-cli@latest dev` | Optional for basic dev; required for background jobs |

### Environment setup caveats

- **Docker in Cloud VM**: Docker daemon must be started manually (`dockerd &>/var/log/dockerd.log &`). The VM requires `fuse-overlayfs` storage driver and `iptables-legacy` — these are configured in `/etc/docker/daemon.json` and via `update-alternatives`.
- **Supabase CLI**: Installed as a standalone binary at `/usr/local/bin/supabase` (not via npm/brew). The npm package `supabase` does not support global install.
- **pnpm blocked build scripts**: After `pnpm install`, you may see warnings about blocked build scripts for `protobufjs` and `unrs-resolver`. These are non-critical; the app works without them.
- **ESLint config for web app**: The web app requires an `.eslintrc.json` file with `"extends": "next/core-web-vitals"` to avoid an interactive prompt when running `next lint`.
- **Pre-existing lint/type errors**: The `mobile` app has pre-existing lint errors (`no-undef` for `__dirname` in metro.config.js) and a type error in `hooks/useTingleLogger.ts`. The `web` app has `@typescript-eslint/no-explicit-any` rule resolution errors (version mismatch). These are in the existing codebase and do not affect the web dev server.
- **Supabase env keys**: After `supabase start`, run `supabase status -o env` to get `ANON_KEY`, `SERVICE_ROLE_KEY`, and `PUBLISHABLE_KEY`. Copy these into `apps/web/.env.local`.

### Commands reference

- **Install deps**: `pnpm install`
- **Lint (web)**: `pnpm --filter web lint`
- **Type-check (web)**: `pnpm --filter web type-check`
- **Type-check (all)**: `pnpm turbo type-check`
- **Tests**: `pnpm --filter @tingle/ai test` (vitest in `packages/ai`)
- **Dev server**: `pnpm --filter web dev`
- **Generate DB types**: `pnpm --filter @tingle/database generate-types`

### External API keys (not needed for basic dev/demo)

`ANTHROPIC_API_KEY`, `YOUTUBE_DATA_API_KEY`, `STRIPE_*` keys, and `INNGEST_*` keys are needed for full functionality but the app starts and the `/demo` page works without them.
