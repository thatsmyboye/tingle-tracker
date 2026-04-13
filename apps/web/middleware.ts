import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase-ssr";

// =============================================================================
// Route protection middleware
//
// - /dashboard/**, /profile/**, /admin/** → require authenticated, non-anonymous session
// - /login, /signup → redirect to /profile if already authenticated
// =============================================================================

const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/admin"];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createMiddlewareSupabaseClient(request, response);

  // getUser() validates the JWT against Supabase's server — more secure than
  // getSession() which only decodes the JWT locally without server validation.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAnonymous = !!(user as { is_anonymous?: boolean } | null)?.is_anonymous;
  const isAuthenticated = !!user && !isAnonymous;
  const { pathname } = request.nextUrl;

  // Protect dashboard, profile, and admin routes
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/profile", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals, static files, and API routes
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
