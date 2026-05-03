import { describe, expect, it } from "vitest";
import {
  formatEvidenceCount,
  getEvidenceLabels,
  normalizeCalculationBasis,
  normalizeConfidenceText,
  summarizeEvidenceRefs,
} from "./evidence";

describe("evidence helpers", () => {
  it("normalizes generic evidence refs into short labels and count summaries", () => {
    const refs = [
      {
        entityType: "trace",
        entityId: "trace_42",
        label: "  High-risk escalation trace  ",
      },
      {
        entityType: "eval_result",
        entityId: "result_7",
      },
      {
        entityType: "trace",
        entityId: "trace_42",
        label: "High-risk escalation trace",
      },
      null,
      {
        label: "",
      },
    ];

    expect(getEvidenceLabels(refs)).toEqual([
      "High-risk escalation trace",
      "Eval result result_7",
    ]);
    expect(formatEvidenceCount(refs)).toBe("2 evidence refs");
    expect(summarizeEvidenceRefs(refs)).toEqual({
      count: 2,
      labels: ["High-risk escalation trace", "Eval result result_7"],
      label: "High-risk escalation trace +1 more",
      countLabel: "2 evidence refs",
    });
  });

  it("normalizes calculation basis text for recommendations and reports", () => {
    expect(
      normalizeCalculationBasis("  based on baseline pass rate\nand routing latency p95  "),
    ).toBe("Based on baseline pass rate and routing latency p95.");
    expect(normalizeCalculationBasis(["eval pass rate", "trace sample size"])).toBe(
      "Eval pass rate; trace sample size.",
    );
    expect(normalizeCalculationBasis("")).toBe("Basis not specified.");
  });

  it("normalizes confidence values into short report labels", () => {
    expect(normalizeConfidenceText(0.92)).toBe("High confidence");
    expect(normalizeConfidenceText(0.64)).toBe("Medium confidence");
    expect(normalizeConfidenceText(42)).toBe("Low confidence");
    expect(normalizeConfidenceText("  needs human review  ")).toBe("Needs human review");
    expect(normalizeConfidenceText(undefined)).toBe("Confidence not specified");
  });
});
