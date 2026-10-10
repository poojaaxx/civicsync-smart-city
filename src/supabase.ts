import { createClient } from "@supabase/supabase-js";
import { validateAuthConfig } from "./auth-config";
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();
validateAuthConfig(url, key);
export const isConfigured = Boolean(url && key);
export const supabase = isConfigured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}
