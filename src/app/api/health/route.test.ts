import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("health route", () => {
  it("returns public liveness without requiring vendor credentials", async () => {
    const route = await import("./route");

    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        service: "evalops-copilot",
      }),
    );
    expect(payload).not.toHaveProperty("checks");
  });

  it("fails visibly if hosted production is accidentally put in test mode", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("EVALOPS_TEST_MODE", "1");
    const route = await import("./route");

    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("production_test_mode");
  });
});
