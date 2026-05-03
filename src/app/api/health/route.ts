import { NextResponse } from "next/server";
import { assertProductionRuntimeSafe, getRuntimeInfo } from "@/lib/server/env";
import { logServerEvent } from "@/lib/server/logger";

export function GET() {
  try {
    assertProductionRuntimeSafe();
    return noStoreJson({
      ok: true,
      service: "evalops-copilot",
      timestamp: new Date().toISOString(),
      runtime: getRuntimeInfo(),
    });
  } catch (error) {
    logServerEvent("error", "health.failed", { error });
    return noStoreJson(
      {
        ok: false,
        error: {
          code: "production_test_mode",
          message: "Hosted production cannot run with EVALOPS_TEST_MODE=1.",
        },
      },
      503,
    );
  }
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}
