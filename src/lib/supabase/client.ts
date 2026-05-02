import { createBrowserClient } from "@supabase/ssr";

type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>;

let browserClient: SupabaseBrowserClient | null = null;

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient(url, key);
  }

  return browserClient;
}

export const supabaseTables = [
  "organizations",
  "users",
  "projects",
  "trace_imports",
  "traces",
  "intents",
  "eval_datasets",
  "eval_cases",
  "graders",
  "eval_runs",
  "eval_results",
  "failure_clusters",
  "prompt_versions",
  "prompt_candidates",
  "routing_rules",
  "cache_recommendations",
  "reports",
] as const;
