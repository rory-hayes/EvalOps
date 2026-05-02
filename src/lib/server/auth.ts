import type { NextRequest } from "next/server";
import { isTestMode } from "./env";
import type { ActorContext } from "./types";

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

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    throw new ApiError(
      503,
      "Authentication is not configured. Set Clerk environment variables or enable EVALOPS_TEST_MODE=1 for local test runs.",
      "auth_not_configured",
    );
  }

  const { auth } = await import("@clerk/nextjs/server");
  const session = await auth();
  if (!session.userId) {
    throw new ApiError(401, "Sign in required.", "unauthenticated");
  }

  return {
    userId: session.userId,
    organizationId: session.orgId || `org_${session.userId}`,
  };
}
