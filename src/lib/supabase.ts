import { createClient } from "@supabase/supabase-js";

// These values are intentionally public client configuration.
// The Supabase publishable key is designed to be exposed in browser applications.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ??
  "https://bpvaftobiosjesdbaany.supabase.co";

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_EsH6rhQ7pJ0SP6dM9_tILA_KO7MShd1";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function isSupabaseConfigured() {
  return true;
}
