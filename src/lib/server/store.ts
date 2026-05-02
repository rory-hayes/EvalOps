import { join } from "node:path";
import { createLocalEvalOpsStore } from "./local-store";
import { createSupabaseEvalOpsStore } from "./supabase-store";
import { hasSupabaseServerConfig, isTestMode } from "./env";
import type { EvalOpsStore } from "./types";

let storePromise: Promise<EvalOpsStore> | null = null;

export function getEvalOpsStore() {
  if (!storePromise) {
    storePromise = createStore();
  }
  return storePromise;
}

async function createStore() {
  if (isTestMode()) {
    return createLocalEvalOpsStore({
      rootDir: process.env.EVALOPS_TEST_STORE_PATH || join(process.cwd(), ".evalops"),
    });
  }

  if (!hasSupabaseServerConfig()) {
    throw new Error(
      "Supabase server configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.",
    );
  }

  return createSupabaseEvalOpsStore();
}
