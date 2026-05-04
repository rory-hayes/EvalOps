import { describe, expect, it } from "vitest";
import { buildReadinessReport } from "./readiness-report";
import type { EvallerRunDetail } from "./types";

describe("buildReadinessReport", () => {
  it("marks a failed baseline as not ready with prompt-fix guidance", () => {
    const report = buildReadinessReport(runDetail({
      passRate: 0,
      averageScore: 25,
      failedScenarios: 3,
      promptVersionLabel: "Prompt v1",
      results: [
        failedResult("Frustrated billing issue", ["Acknowledges user frustration or urgency"]),
        failedResult("Privacy deletion request", ["Offers a human handoff for billing, privacy, or urgent issues"]),
        failedResult("Stuck account setup", ["Does not promise unsupported account, billing, or deletion actions"]),
      ],
    }));

    expect(report.status).toBe("Not ready");
    expect(report.summary).toBe("0% pass rate across 3 scenarios with 3 still failing.");
    expect(report.remainingRisks).toContain("Frustrated billing issue: Acknowledges user frustration or urgency");
    expect(report.recommendedNextStep).toBe("Apply the highest-impact prompt fix, then rerun before release review.");
    expect(report.copyText).toContain("AI Release Readiness Report");
    expect(report.copyText).toContain("Status: Not ready");
  });

  it("marks an all-pass improved run as ready for release review", () => {
    const report = buildReadinessReport(runDetail({
      passRate: 100,
      averageScore: 100,
      failedScenarios: 0,
      promptVersionLabel: "Prompt v2: Add explicit support handoff and safety rules",
      previousRun: {
        id: "run_previous",
        aiTestId: "ai_test_1",
        organizationId: "org_1",
        promptVersionId: "prompt_1",
        promptVersionLabel: "Prompt v1",
        status: "completed",
        qualityBar: 80,
        passRate: 0,
        averageScore: 25,
        totalScenarios: 3,
        failedScenarios: 3,
        startedAt: "2026-05-04T12:00:00.000Z",
        completedAt: "2026-05-04T12:00:00.000Z",
      },
      results: [
        passedResult("Frustrated billing issue"),
        passedResult("Privacy deletion request"),
        passedResult("Stuck account setup"),
      ],
    }));

    expect(report.status).toBe("Ready for release review");
    expect(report.summary).toBe("100% pass rate across 3 scenarios, up 100% from the previous run.");
    expect(report.appliedPromptChange).toBe("Prompt v2: Add explicit support handoff and safety rules");
    expect(report.remainingRisks).toEqual(["No open scenario failures in the latest run."]);
    expect(report.recommendedNextStep).toBe("Use this prompt as the release candidate and keep these scenarios as regression checks.");
    expect(report.copyText).toContain("Remaining risks:\n- No open scenario failures in the latest run.");
  });

  it("marks a partial improvement as needing follow-up", () => {
    const report = buildReadinessReport(runDetail({
      passRate: 66.7,
      averageScore: 91.7,
      failedScenarios: 1,
      promptVersionLabel: "Prompt v2: Add explicit support handoff and safety rules",
      previousRun: {
        id: "run_previous",
        aiTestId: "ai_test_1",
        organizationId: "org_1",
        promptVersionId: "prompt_1",
        promptVersionLabel: "Prompt v1",
        status: "completed",
        qualityBar: 80,
        passRate: 0,
        averageScore: 25,
        totalScenarios: 3,
        failedScenarios: 3,
        startedAt: "2026-05-04T12:00:00.000Z",
        completedAt: "2026-05-04T12:00:00.000Z",
      },
      results: [
        passedResult("Frustrated billing issue"),
        passedResult("Privacy deletion request"),
        failedResult("Stuck account setup", ["Does not promise unsupported account, billing, or deletion actions"]),
      ],
    }));

    expect(report.status).toBe("Improved, needs follow-up");
    expect(report.summary).toBe("66.7% pass rate across 3 scenarios, up 66.7% from the previous run.");
    expect(report.remainingRisks).toEqual(["Stuck account setup: Does not promise unsupported account, billing, or deletion actions"]);
    expect(report.recommendedNextStep).toBe("Review the remaining failed scenarios and add one targeted prompt rule before release.");
  });
});

function runDetail(patch: Partial<EvallerRunDetail>): EvallerRunDetail {
  return {
    id: "run_1",
    aiTestId: "ai_test_1",
    organizationId: "org_1",
    promptVersionId: "prompt_1",
    promptVersionLabel: "Prompt v1",
    status: "completed",
    qualityBar: 80,
    passRate: 0,
    averageScore: 0,
    totalScenarios: patch.results?.length || 0,
    failedScenarios: 0,
    startedAt: "2026-05-04T12:00:00.000Z",
    completedAt: "2026-05-04T12:00:00.000Z",
    results: [],
    failurePatterns: [],
    promptSuggestions: [],
    ...patch,
  };
}

function passedResult(title: string): EvallerRunDetail["results"][number] {
  return {
    id: `result_${title}`,
    runId: "run_1",
    scenarioId: `scenario_${title}`,
    organizationId: "org_1",
    aiTestId: "ai_test_1",
    scenarioTitle: title,
    scenarioMessage: "User message",
    assistantResponse: "Safe assistant response",
    score: 100,
    status: "passed",
    passedCriteria: ["Criterion"],
    failedCriteria: [],
    rationale: "Passed.",
    createdAt: "2026-05-04T12:00:00.000Z",
  };
}

function failedResult(title: string, failedCriteria: string[]): EvallerRunDetail["results"][number] {
  return {
    id: `result_${title}`,
    runId: "run_1",
    scenarioId: `scenario_${title}`,
    organizationId: "org_1",
    aiTestId: "ai_test_1",
    scenarioTitle: title,
    scenarioMessage: "User message",
    assistantResponse: "Unsafe assistant response",
    score: 25,
    status: "failed",
    passedCriteria: [],
    failedCriteria,
    rationale: "Failed.",
    createdAt: "2026-05-04T12:00:00.000Z",
  };
}
