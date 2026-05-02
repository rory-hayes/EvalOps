import { describe, expect, it } from "vitest";
import {
  computeAuditReadiness,
  evalCaseSchema,
  traceImportSchema,
} from "./audit";

describe("audit domain helpers", () => {
  it("scores audit readiness from coverage, calibration, pass rate, and stale risk", () => {
    expect(
      computeAuditReadiness({
        intentCoverage: 92.6,
        judgeCalibration: 92,
        regressionPassRate: 94.3,
        staleEvalRisk: "medium",
      }),
    ).toEqual({
      score: 92,
      label: "Operational",
      recommendation: "Expand coverage for weak intents and keep calibration fresh.",
    });
  });

  it("validates trace imports without allowing unknown source types", () => {
    const parsed = traceImportSchema.safeParse({
      id: "imp_1",
      source: "CSV",
      name: "support_logs.csv",
      importedAt: "2026-05-01T10:24:00.000Z",
      traces: 1248,
      rows: 18347,
      status: "processing",
      redactionStatus: "in_progress",
      primaryIntent: "Billing Issue",
      riskLevel: "medium",
    });

    expect(parsed.success).toBe(true);
    expect(traceImportSchema.safeParse({ ...parsed.data, source: "CRM" }).success).toBe(
      false,
    );
  });

  it("requires eval cases to keep expected behavior and acceptance criteria explicit", () => {
    const parsed = evalCaseSchema.safeParse({
      id: "GS-1024",
      name: "Billing dispute - overcharge",
      set: "golden",
      intent: "Billing",
      source: "production",
      risk: "medium",
      grader: "Rubric v2.1",
      lastResult: 92,
      status: "passed",
      userInput: "I was charged twice for the Pro plan.",
      expectedBehavior:
        "The assistant confirms the duplicate charge and explains refund timing.",
      acceptanceCriteria: [
        "Identifies duplicate charge",
        "Acknowledges impact",
        "Refunds extra charge",
      ],
    });

    expect(parsed.success).toBe(true);
    expect(
      evalCaseSchema.safeParse({
        ...parsed.data,
        expectedBehavior: "",
        acceptanceCriteria: [],
      }).success,
    ).toBe(false);
  });
});
