# Tingle Tracker

**Live:** [https://tingle-tracker.vercel.app](https://tingletracker.banton-digital.com/) · **Repo:** https://github.com/thatsmyboye/tingle-tracker

ASMR companion platform where listeners log tingle moments in real time and creators receive AI-powered heatmaps and trigger analysis.

---

## Experience Overview

### For Listeners

You put on headphones, open a video, and tap **✦** the instant you feel a tingle. That's it. No friction — the first tap creates an anonymous session automatically. As the video plays you mark each moment and optionally rate intensity from 1 (Mild) to 5 (Intense). A live heatmap builds up in front of you, showing exactly which parts of the video hit hardest.

Over sessions, a personal trigger profile takes shape: soft tapping works every time at intensity 4+, paper sounds hit lighter, visual hand movements barely register for you. That fingerprint gets used to surface creators whose content matches how you respond — not just what category they're in, but which specific moments would land.

### For Creators

You paste a YouTube URL into the dashboard. The platform pulls metadata and transcript, then sends the content through a Claude-powered pipeline that classifies which ASMR triggers appear and when. Minutes later your dashboard shows a crowd-sourced heatmap — every listener's tap aggregated into a bar chart over your video's timeline — plus a ranked list of detected triggers with confidence scores and timestamp examples.

Multiple videos build up a catalog view: your top triggers across everything you've made, total tingle counts per video, which content performs. The data comes from real listener responses, not just what the transcript says.

---

## For Listeners

| Feature | Description |
|---|---|
| **Real-time tingle logging** | Tap ✦ to log a tingle at the current playback timestamp |
| **Intensity scale (1–5)** | Mild · Light · Medium · Strong · Intense |
| **Guest mode** | First tap creates an anonymous session — no signup required to start |
| **500ms debounce** | Prevents accidental double-logs; each tap is intentional |
| **Session heatmap** | Visualize your tingle distribution as you log |
| **Offline queue** | Tingles logged while offline are queued (AsyncStorage on mobile, sessionStorage on web) and flushed on reconnect |
| **Account merge** | Sign in after a guest session and all anonymous tingles transfer to your account |
| **Personal trigger profile** | Aggregated view of which triggers affect you and how intensely *(Phase 3)* |
| **Creator discovery** | Find creators whose content matches your trigger fingerprint *(Phase 3)* |

---

## For Creators

| Feature | Description |
|---|---|
| **YouTube ingestion** | Paste a video URL — metadata, thumbnail, transcript, and duration fetched automatically via YouTube Data API v3 |
| **AI trigger classification** | Claude analyzes title, description, and transcript to identify ASMR triggers from a curated taxonomy |
| **Crowd-sourced heatmaps** | All listener taps aggregated into 10-second buckets, visualized as a bar chart over the video timeline |
| **Trigger confidence scores** | Each detected trigger has a 0–1 confidence score with LLM reasoning and timestamp examples |
| **Top triggers panel** | Ranked view of your strongest triggers aggregated across your entire catalog |
| **Status pipeline** | `pending → processing → ready` with live polling on the content detail page |
| **Insight reports** | Structured JSON report per video stored in `insights_cache`, accessible via dashboard |
| **Per-video analytics** | Total tingle count, average intensity, duration, and full heatmap per video |

---

## Features at a Glance

| Feature | Listeners | Creators |
|---|---|---|
| Tingle logging | ✓ real-time, debounced | — |
| Intensity rating (1–5) | ✓ | — |
| Guest / anonymous mode | ✓ no signup needed | — |
| Personal trigger profile | ✓ *(Phase 3)* | — |
| AI trigger analysis | — | ✓ Claude-powered |
| Crowd-sourced heatmaps | own session | full audience |
| YouTube metadata ingest | — | ✓ automatic |
| Creator dashboard | — | ✓ |
| Catalog top triggers | — | ✓ |
| Discovery | *(Phase 3)* | *(Phase 3)* |
| Mobile app | ✓ primary surface | ✓ |
| Offline support | ✓ queue + flush | — |

---

## Interactive Demo

Visit [`/demo`](https://tingle-tracker.vercel.app/demo) for a fully interactive walkthrough — no account required.

- **Listener tab** — simulated playback with a live tingle logger and real-time heatmap
- **Creator tab** — animated pipeline walkthrough ending in a mock trigger analysis report

The demo is self-contained (no backend calls) and kept in sync with the live experience at `apps/web/app/demo/`.

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

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 10+ (`npm install -g pnpm`)
- Docker (for local Supabase)
- Supabase CLI (`brew install supabase/tap/supabase`)

### Setup

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Start local Supabase (requires Docker)
supabase start

# 3. Apply migrations and seed data
supabase db reset

# 4. Regenerate TypeScript types (after schema changes)
pnpm --filter @tingle/database generate-types

# 5. Copy and fill environment files
cp apps/web/.env.local.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
# Fill in values printed by: supabase status

# 6. Start the web dev server
pnpm --filter web dev

# 7. Start the mobile dev server (separate terminal)
pnpm --filter mobile dev
```

### Useful Commands

```bash
pnpm turbo build          # build all packages
pnpm turbo type-check     # type-check all packages
pnpm --filter web dev     # web only (localhost:3000)
pnpm --filter mobile dev  # expo dev server
```

---

## Trigger Taxonomy

Triggers are seeded via `supabase/seed.sql` and never created programmatically. Claude maps content to existing tags only.

| Category | Description |
|---|---|
| `aural` | Sound-based triggers: whispers, tapping, paper, keyboard |
| `visual` | Visual triggers: slow hand movements, close-up detail, light |
| `tactile_adjacent` | Sounds that evoke touch: brushing, scratching, fabric |

---

## Development Status

| Phase | Epics | Points | Status |
|---|---|---|---|
| 1 — Core Loop (MVP) | data-model, content-ingest, tingle-logger, heatmap-viz | 26 | In progress |
| 2 — Intelligence (LLM) | trigger-taxonomy, llm-pipeline, creator-dashboard | 24 | Planned |
| 3 — Discovery | user-profile, discovery | 21 | Planned |
| **Total** | | **71** | |

---

## Contributing

See [CLAUDE.md](./CLAUDE.md) for architecture conventions, database rules, AI integration patterns, and commit format guidelines.
