import { createServerClient } from "@supabase/ssr";
import type { Database } from "@tingle/database";
import type { NextRequest, NextResponse } from "next/server";

// =============================================================================
// Middleware Supabase client
//
// Creates a Supabase client that reads/writes the auth session from request
// cookies. Only used in apps/web/middleware.ts — not for page components.
//
// The setAll callback writes refreshed session cookies back to the response so
// they propagate to the browser on every request.
// =============================================================================

export function createMiddlewareSupabaseClient(
  request: NextRequest,
  response: NextResponse,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars for middleware. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY.",
    );
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}
