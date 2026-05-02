import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceKey, requireEnv } from "./env";

export function createSupabaseAdminClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), getSupabaseServiceKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
