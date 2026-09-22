# Dormancy

Tingle Tracker is parked. The interactive demo stays up; everything that spends
money, calls a third-party API, or writes to the database is switched off.

**Still live:** `/`, `/demo`, `/pricing`, `/privacy`, `/terms`, `/login`, and
read-only views for existing accounts.
**Off:** the weekly catalog cron, the whole Claude pipeline, YouTube Data API
calls, Stripe, new sign-ups, channel submissions, and all tingle logging outside
the demo.

`/demo` is safe to leave running because it has no backend at all — it imports
only React, `cn`, shared types and the presentational `HeatmapChart`, keeps its
state in local component state, and never touches Supabase or an API route.

---

## The switch

Everything hangs off one flag in `apps/web/lib/dormancy.ts`:

```ts
export const IS_DORMANT = process.env.NEXT_PUBLIC_TINGLE_DORMANT !== "false";
```

**It is fail-safe.** Unset, empty, or misspelled all mean *dormant*. Only the
exact string `"false"` wakes the app, so a lost or forgotten environment
variable can never silently switch the meter back on.

---

## What is switched off in code

| Layer | Behavior while dormant |
|---|---|
| `app/api/inngest/route.ts` | Serves **zero** functions, so Inngest archives all three on next sync and the `catalog.refresh` weekly cron (`0 3 * * 1`) is unregistered |
| `inngest/functions/*.ts` | Each job throws `NonRetriableError` via `assertNotDormant()` before doing any work |
| `catalog.refresh` triggers | The `cron` trigger is omitted from the definition entirely, not just guarded |
| 17 API routes / 18 handlers | Return `503` with `{ dormant: true }` **before** any auth check or outbound call |
| `/signup` | Dormant notice — existing accounts can still sign in at `/login` |
| `/submit` | Dormant notice |
| `ContentIngestForm` | Replaced with a paused message |
| `useTingleLogger` | `log()` and `flushQueue()` no-op; `signInAnonymously()` is never called, so no new auth users are created |
| Both GitHub Actions | `workflow_dispatch` only — a merge to `main` can no longer touch the production database or redeploy the Fly worker |

The API guards sit on the **first line** of each handler, so a request to
`/api/content/ingest` costs one 503 and never reaches Supabase, YouTube or
Stripe.

### Routes deliberately left working

Read-only `GET`s that only read Supabase and spend nothing:
`/api/discovery/*`, `/api/admin/tagging-health`, `/api/admin/creator-intake`,
`/api/admin/watched-channels`, `/api/creator-intake` (a user reading back their
own submissions).

---

## Manual tasks — these cannot be done from the repo

Ordered by how much they cost you if skipped.

### 1. Pause the Inngest app — **do this one**

Deploying this branch makes the endpoint serve zero functions, but the weekly
cron registration lives in **Inngest Cloud**, not in the repo. It is removed
only when Inngest next syncs with the deployed endpoint. Until then the schedule
still fires, and although the job would now fail closed, the only way to be
certain is to pause it at the source.

> Inngest dashboard → the `tingle-tracker` app → **Pause**, or delete the
> `catalog.refresh` function. Confirm the app shows **0 functions** afterwards.

### 2. Scale the Fly audio worker to zero

`worker/fly.toml` has `auto_start_machines = true`, so any HTTP request wakes a
2 GB machine. Nothing should be calling it now, but an unreferenced machine that
can self-start is exactly the thing to turn off when nobody is watching.

```bash
fly scale count 0 --app tingle-tracker-audio-worker
# or, to keep the config but stop it serving entirely:
fly apps suspend tingle-tracker-audio-worker
```

### 3. Cap the spend at the provider

Belt and braces — this is what protects you if the flag is ever flipped by
accident, since it removes the ability to spend rather than the intent to.

- **Anthropic Console** → revoke the key in `ANTHROPIC_API_KEY`, or set the
  workspace spend limit to `$0`.
- **Google Cloud Console** → disable or delete the `YOUTUBE_DATA_API_KEY` key
  (YouTube Data API v3 quota).
- **Vercel** → you can also delete `ANTHROPIC_API_KEY`, `YOUTUBE_DATA_API_KEY`
  and `STRIPE_SECRET_KEY` from the project's environment variables.

### 4. Stripe cleanup

There are no live subscriptions, so nothing is mid-flight. Still worth doing so
Stripe stops retrying and auto-disabling things on its own:

- Disable the webhook endpoint pointing at `/api/billing/webhook`.
- Archive the four `STRIPE_PRICE_*` prices so they cannot be checked out.

### 5. Set the flag explicitly in Vercel

Not strictly required — unset already means dormant — but an explicit
`NEXT_PUBLIC_TINGLE_DORMANT=true` makes the state obvious to future you.

### 6. The mobile app is NOT covered by this switch

**Worth knowing about.** `apps/mobile` talks to Supabase **directly** with the
anon key and RLS — it does not go through the Next.js API routes, so none of the
guards in this change apply to it. Any installed build will keep writing
`tingle_events` and creating anonymous users.

This only matters if a build is actually out in the wild (TestFlight, an
internal EAS distribution, a sideloaded APK). If one is, the options are:

- Tighten the RLS `INSERT` policy on `tingle_events` (a new migration — note
  `migrate.yml` is now manual-dispatch only, so you would run it deliberately).
- Or rotate the Supabase anon key, which hard-stops every existing build.

If nothing was ever distributed, there is nothing to do here.

### 7. Optional: pause the Supabase project

This stops the database entirely. The demo is unaffected — it never touches
Supabase — but `/login`, `/listen`, `/profile` and `/dashboard` will error, and
existing users lose access to their own data. Only do this if you are happy for
the site to be demo-and-marketing only.

Free-tier projects auto-pause after 7 days of inactivity regardless, so expect
this to happen on its own.

---

## Waking it back up

1. Reverse the manual steps above that you took — **step 1 (Inngest) and step 3
   (API keys) are the ones that actually gate functionality.**
2. Set `NEXT_PUBLIC_TINGLE_DORMANT=false` in the Vercel project.
3. **Redeploy.** `NEXT_PUBLIC_*` variables are inlined into the client bundle at
   build time, so changing the variable alone updates the server routes but
   leaves the pages and forms dormant until a rebuild. A redeploy is required,
   which is a useful accident-preventer in its own right.
4. Restore the `push` triggers in `.github/workflows/migrate.yml` and
   `.github/workflows/deploy-worker.yml` (the original blocks are quoted in the
   comment at the top of each file).
5. Confirm `GET /api/inngest` reports `"function_count": 3` and that the
   `catalog.refresh` cron is listed again in the Inngest dashboard.
