import { createClient } from "@supabase/supabase-js";

// Mobile uses the anon key + RLS for all direct Supabase access.
// For AI/Inngest operations, use EXPO_PUBLIC_API_BASE_URL to call Next.js API routes.

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use AsyncStorage in production; for now use in-memory
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
