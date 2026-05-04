import { describe, expect, it } from "vitest";
import { resolveAuthRedirectPath } from "./redirects";

describe("auth redirects", () => {
  it("keeps post-auth redirects on real workspace routes", () => {
    expect(resolveAuthRedirectPath("/projects")).toBe("/projects");
    expect(resolveAuthRedirectPath("/onboarding")).toBe("/onboarding");
    expect(resolveAuthRedirectPath("/trace-import")).toBe("/trace-import");
    expect(resolveAuthRedirectPath("/dashboard?projectId=proj_1")).toBe("/dashboard?projectId=proj_1");
  });

  it("normalizes signup and unsafe next paths to project setup", () => {
    expect(resolveAuthRedirectPath("/signup")).toBe("/projects");
    expect(resolveAuthRedirectPath("/login")).toBe("/projects");
    expect(resolveAuthRedirectPath("//evil.example/projects")).toBe("/projects");
    expect(resolveAuthRedirectPath("https://evil.example/projects")).toBe("/projects");
  });
});
