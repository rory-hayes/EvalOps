import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "./config";

type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>;

let browserClient: SupabaseBrowserClient | null = null;

export function getSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();

  if (!config) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient(config.url, config.publishableKey);
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
  "human_labels",
  "grader_calibration_runs",
  "grader_calibration_results",
  "failure_clusters",
  "prompt_versions",
  "prompt_candidates",
  "routing_rules",
  "cache_recommendations",
  "reports",
] as const;
