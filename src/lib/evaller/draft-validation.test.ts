import { describe, expect, it } from "vitest";
import { clampQualityBarInput, normalizeQualityBarInput } from "./draft-validation";

describe("quality bar input helpers", () => {
  it("clamps numeric values into the runnable quality range", () => {
    expect(clampQualityBarInput("150")).toBe(100);
    expect(clampQualityBarInput("40")).toBe(50);
    expect(clampQualityBarInput("85")).toBe(85);
  });

  it("returns validation state for temporary invalid number input", () => {
    expect(normalizeQualityBarInput("abc")).toEqual({
      value: null,
      issue: "Enter a whole number between 50 and 100.",
    });
    expect(normalizeQualityBarInput("")).toEqual({
      value: null,
      issue: "Enter a whole number between 50 and 100.",
    });
    expect(normalizeQualityBarInput("85")).toEqual({
      value: 85,
      issue: "",
    });
  });
});
