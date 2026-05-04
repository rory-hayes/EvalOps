import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("server environment gates", () => {
  it("reports missing production runtime variables without exposing values", async () => {
    vi.stubEnv("EVALOPS_TEST_MODE", "0");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_AUDIT_MODEL", "");
    vi.stubEnv("OPENAI_EVALLER_MODEL", "");
    vi.stubEnv("INNGEST_EVENT_KEY", "event-key");
    vi.stubEnv("INNGEST_SIGNING_KEY", "");

    const { checkProductionEnvironment } = await import("./env");

    const result = checkProductionEnvironment();

    expect(result.ok).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "supabase_service_key", status: "missing" }),
        expect.objectContaining({ name: "OPENAI_AUDIT_MODEL", status: "missing" }),
        expect.objectContaining({ name: "OPENAI_EVALLER_MODEL", status: "missing" }),
        expect.objectContaining({ name: "INNGEST_SIGNING_KEY", status: "missing" }),
      ]),
    );
    expect(JSON.stringify(result)).not.toContain("sk-test");
    expect(JSON.stringify(result)).not.toContain("event-key");
  });

  it("fails hosted production when explicit local test mode is enabled", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("EVALOPS_TEST_MODE", "1");

    const { assertProductionRuntimeSafe, checkProductionEnvironment, isTestMode } = await import("./env");

    expect(() => assertProductionRuntimeSafe()).toThrow(/EVALOPS_TEST_MODE=1/);
    expect(() => isTestMode()).toThrow(/EVALOPS_TEST_MODE=1/);
    expect(checkProductionEnvironment().checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "EVALOPS_TEST_MODE", status: "invalid" }),
      ]),
    );
  });

  it("accepts either Supabase secret key env name for server-side access", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_AUDIT_MODEL", "gpt-test");
    vi.stubEnv("OPENAI_EVALLER_MODEL", "gpt-test");
    vi.stubEnv("INNGEST_EVENT_KEY", "event-key");
    vi.stubEnv("INNGEST_SIGNING_KEY", "signing-key");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_stripe");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    vi.stubEnv("STRIPE_STARTER_PRICE_ID", "price_starter");
    vi.stubEnv("STRIPE_GROWTH_PRICE_ID", "price_growth");

    const { checkProductionEnvironment, requireSupabaseServiceKey } = await import("./env");

    expect(requireSupabaseServiceKey()).toBe("service-role");
    expect(checkProductionEnvironment().ok).toBe(true);
  });
});
