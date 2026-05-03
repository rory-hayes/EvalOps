import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabase-admin";
import {
  checkProductionEnvironment,
  getRuntimeInfo,
  type RuntimeCheck,
} from "@/lib/server/env";
import { logServerEvent } from "@/lib/server/logger";

const REQUIRED_BUCKETS = ["evalops-trace-uploads", "evalops-exports"] as const;

export async function GET(request: NextRequest) {
  const token = process.env.EVALOPS_SMOKE_TOKEN?.trim();
  if (!token) {
    return readinessError(503, "readiness_not_configured", "EVALOPS_SMOKE_TOKEN is not configured.");
  }

  if (request.headers.get("authorization") !== `Bearer ${token}`) {
    return readinessError(401, "unauthorized_readiness", "Readiness checks require a valid smoke token.");
  }

  const checks: RuntimeCheck[] = [];
  const envResult = checkProductionEnvironment({ includeSmokeToken: true });
  const envFailures = envResult.checks.filter((check) => check.status !== "ok");
  checks.push({
    name: "production_environment",
    status: envFailures.length ? "invalid" : "ok",
    detail: envFailures.length
      ? `Runtime configuration failures: ${envFailures.map((check) => check.name).join(", ")}.`
      : "Required runtime configuration is present.",
  });
  checks.push(...envResult.checks);

  if (envFailures.length) {
    checks.push({ name: "supabase_database", status: "invalid", detail: "Skipped until env checks pass." });
    for (const bucket of REQUIRED_BUCKETS) {
      checks.push({ name: `storage:${bucket}`, status: "invalid", detail: "Skipped until env checks pass." });
    }
  } else {
    checks.push(...(await checkSupabase()));
  }

  const ok = checks.every((check) => check.status === "ok");
  const payload = {
    ok,
    status: ok ? "ready" : "not_ready",
    timestamp: new Date().toISOString(),
    runtime: getRuntimeInfo(),
    checks,
  };

  if (!ok) {
    logServerEvent("warn", "readiness.not_ready", {
      failedChecks: checks.filter((check) => check.status !== "ok").map((check) => check.name),
    });
  }

  return NextResponse.json(payload, {
    status: ok ? 200 : 503,
    headers: {
      "cache-control": "no-store",
    },
  });
}

async function checkSupabase(): Promise<RuntimeCheck[]> {
  const checks: RuntimeCheck[] = [];
  try {
    const supabase = createSupabaseAdminClient();
    const database = await supabase.from("organizations").select("id", {
      count: "exact",
      head: true,
    });

    checks.push(
      database.error
        ? { name: "supabase_database", status: "invalid", detail: database.error.message }
        : { name: "supabase_database", status: "ok", detail: "Service role can reach Postgres." },
    );

    for (const bucket of REQUIRED_BUCKETS) {
      const result = await supabase.storage.getBucket(bucket);
      checks.push(
        result.error
          ? { name: `storage:${bucket}`, status: "invalid", detail: result.error.message }
          : { name: `storage:${bucket}`, status: "ok", detail: "Bucket exists." },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase readiness check failed.";
    checks.push({ name: "supabase_database", status: "invalid", detail: message });
    for (const bucket of REQUIRED_BUCKETS) {
      checks.push({ name: `storage:${bucket}`, status: "invalid", detail: message });
    }
  }

  return checks;
}

function readinessError(status: number, code: string, message: string) {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    {
      status,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
