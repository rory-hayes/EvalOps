import type { NextRequest } from "next/server";
import { isTestMode } from "./env";
import type { ActorContext } from "./types";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "api_error",
  ) {
    super(message);
  }
}

export async function getActorFromRequest(request: NextRequest): Promise<ActorContext> {
  if (isTestMode()) {
    return {
      userId: request.headers.get("x-evalops-test-user-id") || "user_test_owner",
      email: request.headers.get("x-evalops-test-email") || "founder@example.test",
      organizationId: request.headers.get("x-evalops-test-org-id") || "org_test_evalops",
    };
  }

  if (!hasSupabasePublicConfig()) {
    throw new ApiError(
      503,
      "Authentication is not configured. Set Supabase auth environment variables or enable EVALOPS_TEST_MODE=1 for local test runs.",
      "auth_not_configured",
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiError(401, "Sign in required.", "unauthenticated");
  }

  return {
    userId: user.id,
    email: user.email,
    organizationId: request.cookies.get("evalops_org_id")?.value,
  };
}
