import { describe, expect, it } from "vitest";
import {
  computeAuditReadiness,
  evalDatasetSchema,
  evalCaseSchema,
  evalResultSchema,
  intentSchema,
  traceImportSchema,
  workflowTypeSchema,
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

  it("covers milestone one domain model shells for workflows, intents, datasets, and results", () => {
    expect(workflowTypeSchema.safeParse("support_assistant").success).toBe(true);
    expect(intentSchema.safeParse({
      id: "intent_billing",
      label: "Billing",
      description: "Billing disputes and invoice questions.",
      riskLevel: "medium",
      coveragePercent: 72,
    }).success).toBe(true);
    expect(evalDatasetSchema.safeParse({
      id: "dataset_regression",
      name: "Regression safety",
      set: "regression",
      caseCount: 18,
      coverageIntentIds: ["intent_billing"],
      lastGeneratedAt: "2026-05-01T10:24:00.000Z",
    }).success).toBe(true);
    expect(evalResultSchema.safeParse({
      id: "result_1",
      evalRunId: "run_1",
      evalCaseId: "case_1",
      status: "review",
      score: 68,
      graderId: "grader_1",
      rationale: "The answer missed the required handoff.",
    }).success).toBe(true);
  });
});
