import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { contentProcess } from "@/inngest/functions/content.process";
import { audioAnalyze } from "@/inngest/functions/audio.analyze";
import { catalogRefresh } from "@/inngest/functions/catalog.refresh";
import { IS_DORMANT } from "@/lib/dormancy";

// Allow up to 5 minutes per step invocation so the Fly audio worker step has
// enough time to wake from suspend and complete extraction without being killed
// by Vercel's default timeout.
export const maxDuration = 300;

// =============================================================================
// DORMANT: serve an empty function list.
//
// This is the single most important switch in the dormancy work. Registering
// zero functions makes Inngest archive all three on its next sync, which
// unregisters the catalog.refresh weekly cron (0 3 * * 1) — the only thing in
// this codebase that fires unattended and spends money (YouTube Data API quota,
// Claude tokens, and a wake-up of the Fly audio worker) with nobody watching.
//
// Until that sync happens the cron still lives in Inngest Cloud, so the
// functions themselves also refuse to run while dormant (see the
// assertNotDormant guard in each one) and the Inngest app should be paused in
// the dashboard as well. Three independent layers, because a scheduled job that
// bills you is the one thing worth over-engineering the "off" for.
// =============================================================================
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: IS_DORMANT ? [] : [contentProcess, audioAnalyze, catalogRefresh],
});
