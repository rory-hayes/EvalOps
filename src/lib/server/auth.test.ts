import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("server auth", () => {
  it("keeps deterministic test-mode actors isolated from production auth", async () => {
    vi.stubEnv("EVALOPS_TEST_MODE", "1");
    const { getActorFromRequest } = await import("./auth");

    const actor = await getActorFromRequest(
      new NextRequest("http://localhost/api/app-state", {
        headers: {
          "x-evalops-test-user-id": "user_test",
          "x-evalops-test-email": "tester@example.test",
          "x-evalops-test-org-id": "org_test",
        },
      }),
    );

    expect(actor).toEqual({
      userId: "user_test",
      email: "tester@example.test",
      organizationId: "org_test",
    });
  });

  it("fails visibly when Supabase auth is not configured", async () => {
    const { getActorFromRequest } = await import("./auth");

    await expect(getActorFromRequest(new NextRequest("http://localhost/api/app-state"))).rejects.toMatchObject({
      status: 503,
      code: "auth_not_configured",
      message: expect.stringContaining("Supabase"),
    });
  });

  it("builds an actor from the authenticated Supabase user", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: () => ({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: "57f29644-a54b-4e4b-8d1d-3a4b36c89119",
                email: "founder@example.com",
                user_metadata: { full_name: "Unsafe Client-Editable Name" },
                app_metadata: {},
              },
            },
            error: null,
          }),
        },
      }),
    }));
    const { getActorFromRequest } = await import("./auth");

    await expect(getActorFromRequest(new NextRequest("http://localhost/api/app-state"))).resolves.toEqual({
      userId: "57f29644-a54b-4e4b-8d1d-3a4b36c89119",
      email: "founder@example.com",
      organizationId: undefined,
    });
  });
});
