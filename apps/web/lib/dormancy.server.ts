import { NextResponse } from "next/server";
import { DORMANT_MESSAGE } from "./dormancy";

// =============================================================================
// Server-only dormancy helper. Kept separate from ./dormancy so that client
// components can import IS_DORMANT without pulling in next/server.
// =============================================================================

/**
 * 503 returned by every API route that is switched off while the app is
 * dormant. 503 (rather than 404 or 410) tells well-behaved callers the outage
 * is deliberate and temporary, and keeps the route shape intact for when the
 * app is woken up again.
 */
export function dormantResponse() {
  return NextResponse.json(
    { error: DORMANT_MESSAGE, dormant: true },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}
