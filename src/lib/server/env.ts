export type RuntimeCheckStatus = "ok" | "missing" | "invalid";

export type RuntimeCheck = {
  name: string;
  status: RuntimeCheckStatus;
  detail?: string;
};

export type RuntimeInfo = {
  service: "evalops-copilot";
  environment: string;
  deployment: string;
  commitSha?: string;
};

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "OPENAI_API_KEY",
  "OPENAI_AUDIT_MODEL",
  "INNGEST_EVENT_KEY",
  "INNGEST_SIGNING_KEY",
] as const;

export function assertProductionRuntimeSafe() {
  if (process.env.VERCEL_ENV === "production" && process.env.EVALOPS_TEST_MODE === "1") {
    throw new Error("EVALOPS_TEST_MODE=1 is not allowed in Vercel production.");
  }
}

export function isTestMode() {
  assertProductionRuntimeSafe();
  return process.env.EVALOPS_TEST_MODE === "1";
}

export function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseServiceKey() {
  return (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

export function requireSupabaseServiceKey() {
  const value = getSupabaseServiceKey();
  if (!value) {
    throw new Error("Missing required environment variable: SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY");
  }
  return value;
}

export function hasSupabaseServerConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && getSupabaseServiceKey());
}

export function getRuntimeInfo(): RuntimeInfo {
  return {
    service: "evalops-copilot",
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "local",
    deployment: process.env.VERCEL_URL || "local",
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA,
  };
}

export function checkProductionEnvironment(options: { includeSmokeToken?: boolean } = {}) {
  const checks: RuntimeCheck[] = [];

  if (process.env.VERCEL_ENV === "production" && process.env.EVALOPS_TEST_MODE === "1") {
    checks.push({
      name: "EVALOPS_TEST_MODE",
      status: "invalid",
      detail: "Explicit local test mode cannot be enabled in hosted production.",
    });
  } else {
    checks.push({
      name: "EVALOPS_TEST_MODE",
      status: "ok",
      detail: process.env.EVALOPS_TEST_MODE === "1" ? "Explicit local test mode enabled." : "Production mode.",
    });
  }

  for (const name of REQUIRED_ENV_VARS) {
    checks.push(envPresenceCheck(name));
  }

  checks.push({
    name: "supabase_service_key",
    status: getSupabaseServiceKey() ? "ok" : "missing",
    detail: getSupabaseServiceKey()
      ? "Supabase server key is configured."
      : "Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.",
  });

  if (options.includeSmokeToken) {
    checks.push(envPresenceCheck("EVALOPS_SMOKE_TOKEN"));
  }

  checks.push(...checkStripeEnvironment());

  return {
    ok: checks.every((check) => check.status === "ok"),
    checks,
    runtime: getRuntimeInfo(),
  };
}

export function checkStripeEnvironment() {
  return [
    envPresenceCheck("STRIPE_SECRET_KEY"),
    envPresenceCheck("STRIPE_WEBHOOK_SECRET"),
    envPresenceCheck("STRIPE_STARTER_PRICE_ID"),
    envPresenceCheck("STRIPE_GROWTH_PRICE_ID"),
  ];
}

export function assertProductionEnvironmentConfigured() {
  assertProductionRuntimeSafe();
  const result = checkProductionEnvironment();
  const failures = result.checks.filter((check) => check.status !== "ok");
  if (failures.length) {
    throw new Error(
      `Production runtime is not configured: ${failures.map((check) => check.name).join(", ")}`,
    );
  }
}

function envPresenceCheck(name: string): RuntimeCheck {
  return process.env[name]?.trim()
    ? { name, status: "ok", detail: "Configured." }
    : { name, status: "missing", detail: `Set ${name}.` };
}
