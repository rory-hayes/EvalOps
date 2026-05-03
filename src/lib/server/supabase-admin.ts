import { createClient } from "@supabase/supabase-js";
import { requireEnv, requireSupabaseServiceKey } from "./env";

export function createSupabaseAdminClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireSupabaseServiceKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
