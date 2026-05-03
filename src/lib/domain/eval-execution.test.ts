import { describe, expect, it } from "vitest";
import { executeDeterministicGrader, summarizeEvalResults } from "./eval-execution";
import type { StoredEvalCase, StoredGrader, StoredTrace } from "@/lib/server/types";

describe("eval execution", () => {
  it("scores deterministic graders from redacted trace output and configured thresholds", () => {
    const result = executeDeterministicGrader({
      evalCase: buildEvalCase({
        acceptanceCriteria: ["Acknowledges frustration", "Creates or offers human handoff"],
      }),
      grader: buildGrader({ passThreshold: 0.8, reviewThreshold: 0.6 }),
      trace: buildTrace({
        redactedOutput: "I understand this is frustrating. I can create a support ticket for a human agent.",
      }),
      evalRunId: "run_1",
      promptVersionId: "prompt_1",
      now: "2026-05-03T12:00:00.000Z",
    });

    expect(result.status).toBe("passed");
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.evidenceRefs).toEqual([
      expect.objectContaining({
        entityType: "eval_case",
        entityId: "case_1",
      }),
      expect.objectContaining({
        entityType: "trace",
        entityId: "trace_1",
      }),
    ]);
    expect(result.rationale).toContain("2 of 2");
  });

  it("summarizes pass rate from persisted per-case results", () => {
    expect(
      summarizeEvalResults([
        { status: "passed", score: 92 },
        { status: "review", score: 68 },
        { status: "failed", score: 24 },
      ]),
    ).toEqual({
      totalCases: 3,
      failedCases: 1,
      reviewCases: 1,
      passRate: 33.3,
      averageScore: 61.3,
    });
  });

  it("does not score against or expose raw trace output", () => {
    const result = executeDeterministicGrader({
      evalCase: buildEvalCase({
        acceptanceCriteria: ["Creates or offers human handoff"],
      }),
      grader: buildGrader({ passThreshold: 0.8, reviewThreshold: 0.6 }),
      trace: buildTrace({
        output: "I can route you to founder@example.com and a human agent.",
        redactedOutput: "I can help with the next step.",
        redactionHits: ["email"],
      }),
      evalRunId: "run_1",
      now: "2026-05-03T12:00:00.000Z",
    });

    expect(result.status).toBe("failed");
    expect(result.score).toBe(0);
    expect(JSON.stringify(result)).not.toContain("founder@example.com");
    expect(result.evidenceRefs[1].excerpt).toBe("I can help with the next step.");
  });

  it("uses review thresholds between pass and fail", () => {
    const result = executeDeterministicGrader({
      evalCase: buildEvalCase({
        acceptanceCriteria: ["Acknowledges frustration", "Creates or offers human handoff"],
      }),
      grader: buildGrader({ passThreshold: 0.8, reviewThreshold: 0.5 }),
      trace: buildTrace({
        redactedOutput: "I understand this is frustrating and want to help.",
      }),
      evalRunId: "run_1",
      now: "2026-05-03T12:00:00.000Z",
    });

    expect(result.status).toBe("review");
    expect(result.score).toBe(50);
    expect(result.rationale).toContain("1 of 2");
  });

  it("summarizes empty result sets", () => {
    expect(summarizeEvalResults([])).toEqual({
      totalCases: 0,
      failedCases: 0,
      reviewCases: 0,
      passRate: 0,
      averageScore: 0,
    });
  });
});

function buildEvalCase(overrides: Partial<StoredEvalCase> = {}): StoredEvalCase {
  return {
    id: "case_1",
    organizationId: "org_1",
    projectId: "project_1",
    traceId: "trace_1",
    name: "Escalation handoff",
    set: "regression",
    intent: "Escalation",
    source: "production",
    risk: "high",
    grader: "Escalation rubric",
    lastResult: 0,
    status: "review",
    userInput: "I asked three times and still need help.",
    expectedBehavior: "Acknowledge frustration and offer a human handoff.",
    acceptanceCriteria: ["Creates or offers human handoff"],
    createdAt: "2026-05-03T12:00:00.000Z",
    updatedAt: "2026-05-03T12:00:00.000Z",
    ...overrides,
  };
}

function buildGrader(overrides: Partial<StoredGrader> = {}): StoredGrader {
  return {
    id: "grader_1",
    organizationId: "org_1",
    projectId: "project_1",
    name: "Escalation rubric",
    type: "deterministic",
    description: "Scores escalation handoff quality.",
    health: "healthy",
    agreement: 0.9,
    active: true,
    passThreshold: 0.8,
    reviewThreshold: 0.6,
    rubric: "Give credit for acknowledgement, safe next step, and handoff.",
    failureModes: ["Missing handoff", "Unsupported policy claim"],
    createdAt: "2026-05-03T12:00:00.000Z",
    updatedAt: "2026-05-03T12:00:00.000Z",
    ...overrides,
  };
}

function buildTrace(overrides: Partial<StoredTrace> = {}): StoredTrace {
  return {
    id: "trace_1",
    organizationId: "org_1",
    projectId: "project_1",
    traceImportId: "imp_1",
    externalId: "c_1",
    sourceType: "CSV",
    input: "I asked three times and still need help.",
    output: "I understand this is frustrating. I can create a support ticket for a human agent.",
    redactedInput: "I asked three times and still need help.",
    redactedOutput: "I understand this is frustrating. I can create a support ticket for a human agent.",
    redactionHits: [],
    intent: "Escalation",
    riskLevel: "high",
    occurredAt: "2026-05-03T12:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}
