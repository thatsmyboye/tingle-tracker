import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Database } from "@tingle/database";

// Mobile uses the anon key + RLS for all direct Supabase access.
// For AI/Inngest operations, use EXPO_PUBLIC_API_BASE_URL to call Next.js API routes.

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

// Newer Supabase projects expose PUBLISHABLE_DEFAULT_KEY; older projects use ANON_KEY.
// Support both so the mobile app works regardless of project age.
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL and " +
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (or EXPO_PUBLIC_SUPABASE_ANON_KEY) in .env"
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // AsyncStorage persists the session across app restarts
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
