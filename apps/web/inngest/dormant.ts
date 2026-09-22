import { NonRetriableError } from "inngest";
import { IS_DORMANT } from "@/lib/dormancy";

// =============================================================================
// Per-function dormancy guard.
//
// Defence in depth for the Inngest pipeline. The serve() handler already
// registers zero functions while dormant (see app/api/inngest/route.ts), but
// Inngest Cloud keeps its own copy of the schedule until the app next syncs —
// so a cron registered before the app was parked can still try to invoke us.
//
// NonRetriableError is deliberate: a dormant app is not a transient failure, so
// the run should fail once and stop rather than back off and retry 
// for hours against an endpoint that will keep saying no.
// =============================================================================

export function assertNotDormant(jobId: string): void {
  if (IS_DORMANT) {
    throw new NonRetriableError(
      `[dormant] ${jobId} did not run — Tingle Tracker is dormant. ` +
        `This job spends money (Claude / YouTube Data API / Fly audio worker), ` +
        `so it refuses to execute until the app is woken up. See docs/DORMANCY.md.`
    );
  }
}
