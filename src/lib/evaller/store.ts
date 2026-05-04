import { join } from "node:path";
import { hasSupabaseServerConfig, isTestMode } from "@/lib/server/env";
import type { EvallerStore } from "./types";
import { createLocalEvallerStore } from "./local-store";
import { createSupabaseEvallerStore } from "./supabase-store";

let store: EvallerStore | null = null;

export function getEvallerStore() {
  if (!store) {
    store = createStore();
  }
  return store;
}

function createStore() {
  if (isTestMode()) {
    return createLocalEvallerStore({
      rootDir: process.env.EVALOPS_TEST_STORE_PATH || join(process.cwd(), ".evalops"),
    });
  }

  if (!hasSupabaseServerConfig()) {
    throw new Error(
      "Supabase server configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.",
    );
  }

  return createSupabaseEvallerStore();
}
