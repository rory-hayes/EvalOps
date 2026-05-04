import { describe, expect, it } from "vitest";
import { resolveAuthRedirectPath } from "./redirects";

describe("auth redirects", () => {
  it("keeps post-auth redirects on real workspace routes", () => {
    expect(resolveAuthRedirectPath("/workspace")).toBe("/workspace");
    expect(resolveAuthRedirectPath("/runs")).toBe("/runs");
    expect(resolveAuthRedirectPath("/templates")).toBe("/templates");
    expect(resolveAuthRedirectPath("/settings")).toBe("/settings");
  });

  it("normalizes signup and unsafe next paths to workspace", () => {
    expect(resolveAuthRedirectPath("/signup")).toBe("/workspace");
    expect(resolveAuthRedirectPath("/login")).toBe("/workspace");
    expect(resolveAuthRedirectPath("//evil.example/projects")).toBe("/workspace");
    expect(resolveAuthRedirectPath("https://evil.example/projects")).toBe("/workspace");
  });
});
