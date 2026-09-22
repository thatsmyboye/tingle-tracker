# Tingle Tracker — CLAUDE.md

ASMR companion platform. Creators link YouTube videos and receive tingle heatmaps + LLM-analyzed trigger reports. Listeners log tingle moments, build personal trigger profiles, and discover creators via trigger overlap.

**Deployment:** https://tingle-tracker.vercel.app  
**Repo:** https://github.com/thatsmyboye/tingle-tracker

---

## Status: Dormant

The app is parked. `/demo` and the marketing pages stay up; the Inngest cron,
the Claude pipeline, YouTube ingestion, Stripe and every write path are
switched off behind `IS_DORMANT` in `apps/web/lib/dormancy.ts`.

The flag is **fail-safe** — dormant unless `NEXT_PUBLIC_TINGLE_DORMANT` is the
exact string `"false"`. When adding a route or form that spends money or writes
to the database, gate it the same way:

```ts
// API route — first line of the handler, before any auth or outbound call
if (IS_DORMANT) return dormantResponse();   // from "@/lib/dormancy.server"

// Inngest function — first line of the handler
assertNotDormant("<job.id>");               // from "@/inngest/dormant"
```

See `docs/DORMANCY.md` for what is off, the manual/dashboard steps, and how to
wake the app back up.

---

## Monorepo Structure

```
tingle-tracker/
├── apps/
│   ├── web/          # Next.js 14 App Router (TypeScript strict)
│   └── mobile/       # Expo SDK 51+ (React Native)
├── packages/
│   ├── ui/           # Shared component library (Radix + Tailwind / NativeWind)
│   ├── database/     # Supabase client + generated types
│   ├── ai/           # Claude API wrapper + prompt templates
│   └── types/        # Shared TypeScript interfaces
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── seed.sql
└── CLAUDE.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web frontend | Next.js 14, App Router, TypeScript strict |
| Mobile frontend | Expo SDK 51+, React Native |
| Shared UI | Tailwind CSS + Radix UI (web), NativeWind (mobile) |
| Auth + DB | Supabase (Postgres + RLS + Realtime) |
| Background jobs | Inngest |
| AI / LLM | Claude API via `@anthropic-ai/sdk` |
| Billing | Stripe |
| Hosting | Vercel |
| Monorepo | Turborepo + pnpm |

---

## Package Manager

**Always use `pnpm`.** Never use `npm` or `yarn`.

```bash
pnpm install                          # install all workspace deps
pnpm --filter web dev                 # run web dev server
pnpm --filter mobile dev              # run expo dev server
pnpm turbo build                      # build all packages
pnpm turbo type-check                 # type-check all packages
```

---

## Key Conventions

### Supabase

- Client (browser/mobile): `packages/database/src/client.ts` → `getSupabaseBrowserClient()`
- Client (server/Inngest): `packages/database/src/client.ts` → `getSupabaseServerClient()`
- Generated types: `packages/database/src/database.types.ts`
  - Regenerate: `pnpm --filter @tingle/database generate-types`
- **Never edit applied migrations.** Create new ones:
  ```bash
  supabase migration new <description>
  ```

### AI / Claude

- Model constant: `CLAUDE_MODEL` in `packages/ai/src/client.ts` — **never hardcode elsewhere**
- Current model: `claude-sonnet-4-20250514`
- Prompt templates: `packages/ai/src/prompts/`
- **All Claude API calls from the web app must go through Inngest jobs** — never call Claude from Next.js API routes directly
- Inngest functions: `apps/web/inngest/functions/` with naming `<noun>.<verb>.ts`

### Mobile ↔ Backend

- **Direct Supabase** for tingle logging, realtime, and auth (uses anon key + RLS)
- **Next.js API routes** (`EXPO_PUBLIC_API_BASE_URL`) for AI/Inngest-triggered operations (keeps `ANTHROPIC_API_KEY` server-side)

### TypeScript

- Strict mode everywhere — no `any` without an explanatory comment
- Use Zod for runtime validation at system boundaries (API routes, Inngest payloads)
- Prefer `async/await` over `.then()`
- Wrap external API calls in `try/catch`, return typed error objects

### Components

- Functional only, no class components
- Named exports preferred; default exports only for Next.js pages/layouts and Expo screens
- File naming: `PascalCase.tsx` for components, `camelCase.ts` for utilities/hooks
- API routes: `route.ts` in appropriate `app/api/` folder

---

## Database Conventions

- Tables: `snake_case`, plural (e.g. `tingle_events`, `trigger_tags`)
- Columns: `snake_case`
- Foreign keys: `<table_singular>_id` (e.g. `content_id`, `creator_id`)
- Timestamps: always `created_at` + `updated_at` with `DEFAULT now()`
- PKs: always `gen_random_uuid()`

### RLS Summary

| Table | Read | Write |
|---|---|---|
| `tingle_events` | Owner only (+ creator aggregate) | Owner only |
| `user_profiles` | Owner only | Owner only |
| `creators` | Public | Owner only |
| `content` | Public | Owner (via creator FK) |
| `content_triggers` | Public | Owner (via creator FK) |
| `insights_cache` | Content owner only | Service role only (Inngest) |
| `trigger_tags` | Public | Service role only |

---

## Environment Variables

### `apps/web/.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=
# New Supabase projects: use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (replaces ANON_KEY)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# Shared Pooler URL (IPv4 compatible) — use for migrations and direct DB access
# Format: postgresql://postgres.PROJECT_REF:PASSWORD@REGION.pooler.supabase.com:5432/postgres
SUPABASE_DB_URL=
ANTHROPIC_API_KEY=
YOUTUBE_DATA_API_KEY=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

### `apps/mobile/.env`

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_BASE_URL=
```

**Never commit `.env` files. Never log environment variable values.**

---

## YouTube Integration

- YouTube Data API v3 for metadata (title, description, duration, thumbnails)
- YouTube oEmbed for lightweight embeds
- YouTube Captions API for transcripts
- Store `youtube_video_id` only — never full URLs
- Web player: `react-youtube` or custom iframe in `packages/ui`

---

## Tingle Logging UX

- Mobile is the primary surface (headphone/phone-native)
- Single tap: log tingle at current playback timestamp
- Long press (300ms): open intensity picker (1–5)
- Events debounced: minimum 500ms between events
- `timestamp_ms`: integer, milliseconds from video start
- Offline queue: AsyncStorage (mobile), sessionStorage (web)

---

## Trigger Taxonomy

- Categories: `visual` | `aural` | `tactile_adjacent`
- `trigger_tags` table seeded via `supabase/seed.sql` — **never add tags programmatically**
- LLM classification maps content to existing tags only (no new tag creation)

---

## Development Phases

| Phase | Epics | Points |
|---|---|---|
| 1 — Core Loop (MVP) | data-model, content-ingest, tingle-logger, heatmap-viz | 26 |
| 2 — Intelligence (LLM) | trigger-taxonomy, llm-pipeline, creator-dashboard | 24 |
| 3 — Discovery | user-profile, discovery | 21 |
| **Total** | | **71** |

---

## Commit Convention

```
git commit -m "[<epic-id>] <description>"
```

Examples:
- `[data-model] add initial schema migration`
- `[tingle-logger] add intensity picker component`
- `[llm-pipeline] add trigger classification Inngest job`

---

## Local Dev Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start local Supabase (requires Docker)
supabase start

# 3. Apply migration + seed
supabase db reset

# 4. Generate TypeScript types
pnpm --filter @tingle/database generate-types

# 5. Copy env files
cp apps/web/.env.local.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
# Fill in values from: supabase status

# 6. Start web dev server
pnpm --filter web dev
```
