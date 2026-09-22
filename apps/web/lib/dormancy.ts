// =============================================================================
// Dormancy kill switch
//
// The app is parked. The interactive demo (/demo) and the static marketing
// pages stay up; everything that spends money (Claude, YouTube Data API,
// Stripe, the Fly audio worker) or writes to the database is switched off.
//
// Fail-safe by design: the app is dormant unless NEXT_PUBLIC_TINGLE_DORMANT is
// explicitly set to the string "false". An unset, misspelled, or empty variable
// leaves the app dormant rather than silently waking it.
//
// To bring the app back, see docs/DORMANCY.md — flipping this flag alone is not
// enough, the external services have to be re-enabled too.
//
// This module is isomorphic (no next/server import) so client components can
// read IS_DORMANT. API routes use dormantResponse() from ./dormancy.server.
// =============================================================================

export const IS_DORMANT = process.env.NEXT_PUBLIC_TINGLE_DORMANT !== "false";

export const DORMANT_MESSAGE =
  "Tingle Tracker is dormant. The interactive demo is still available at /demo.";
