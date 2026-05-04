import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("readiness route", () => {
  it("requires a smoke token before revealing readiness checks", async () => {
    vi.stubEnv("EVALOPS_SMOKE_TOKEN", "smoke-token");
    const route = await import("./route");

    const response = await route.GET(new NextRequest("http://localhost/api/readiness"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("unauthorized_readiness");
  });

  it("returns readiness checks for env, Supabase, storage, Inngest, and OpenAI", async () => {
    vi.stubEnv("EVALOPS_SMOKE_TOKEN", "smoke-token");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("SUPABASE_SECRET_KEY", "service-role");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_AUDIT_MODEL", "gpt-test");
    vi.stubEnv("OPENAI_EVALLER_MODEL", "gpt-test");
    vi.stubEnv("INNGEST_EVENT_KEY", "event-key");
    vi.stubEnv("INNGEST_SIGNING_KEY", "signing-key");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_stripe");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    vi.stubEnv("STRIPE_STARTER_PRICE_ID", "price_starter");
    vi.stubEnv("STRIPE_GROWTH_PRICE_ID", "price_growth");
    vi.doMock("@/lib/server/supabase-admin", () => ({
      createSupabaseAdminClient: () => ({
        from: () => ({
          select: vi.fn().mockReturnValue({ error: null }),
        }),
        storage: {
          getBucket: vi.fn().mockResolvedValue({ data: { id: "bucket" }, error: null }),
        },
      }),
    }));
    const route = await import("./route");

    const response = await route.GET(
      new NextRequest("http://localhost/api/readiness", {
        headers: { authorization: "Bearer smoke-token" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "production_environment", status: "ok" }),
        expect.objectContaining({ name: "supabase_database", status: "ok" }),
        expect.objectContaining({ name: "storage:evalops-trace-uploads", status: "ok" }),
        expect.objectContaining({ name: "storage:evalops-exports", status: "ok" }),
      ]),
    );
    expect(JSON.stringify(payload)).not.toContain("smoke-token");
    expect(JSON.stringify(payload)).not.toContain("service-role");
  });
});
