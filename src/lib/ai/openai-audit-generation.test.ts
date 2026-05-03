import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOpenAIAuditPrompt, mapParsedAuditOutput, requireOpenAIAuditConfig } from "./openai-audit-generation";
import type { NormalizedTrace } from "@/lib/domain/trace-processing";
import type { Project } from "@/lib/server/types";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OpenAI audit generation", () => {
  it("requires an API key and model outside explicit test mode", () => {
    vi.stubEnv("EVALOPS_TEST_MODE", "0");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_AUDIT_MODEL", "");

    expect(() => requireOpenAIAuditConfig()).toThrow(/OPENAI_API_KEY/);

    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    expect(() => requireOpenAIAuditConfig()).toThrow(/OPENAI_AUDIT_MODEL/);
  });

  it("maps parsed structured output into persisted audit artifacts", () => {
    const project = buildProject();
    const traces = [buildTrace()];

    const result = mapParsedAuditOutput({
      project,
      traces,
      generatedAt: "2026-05-03T12:00:00.000Z",
      output: {
        cases: [
          {
            name: "Escalation handoff regression",
            intent: "Escalation",
            set: "regression",
            sourceTraceId: "trace_1",
            userInput: "User needs help after repeated failures.",
            expectedBehavior: "Acknowledge frustration and offer a human handoff.",
            acceptanceCriteria: ["Acknowledges frustration", "Offers human handoff"],
            risk: "high",
            grader: "Escalation policy judge",
            lastResult: 42,
            status: "failed",
            source: "production",
          },
        ],
        issues: [
          {
            evalCaseName: "Escalation handoff regression",
            title: "Escalation handoff missing",
            severity: "high",
            description: "The answer did not offer a human escalation path.",
          },
        ],
        graders: [
          {
            name: "Escalation policy judge",
            type: "llm_judge",
            description: "Scores escalation correctness against the audit rubric.",
            health: "review",
            agreement: 0.74,
            model: "gpt-5.5",
          },
        ],
        promptCandidates: [
          {
            title: "Escalation-first support prompt",
            expectedQualityLift: 13,
            expectedCostDelta: 2,
            regressionRisk: "low",
            explanation: "Adds explicit frustration and handoff rules.",
          },
        ],
        routingRules: [
          {
            intent: "Escalation",
            model: "gpt-5.5",
            fallback: "Human review",
            qualityScore: 91,
            estimatedCost: 0.035,
            estimatedLatencyMs: 2200,
            trafficShare: 12,
          },
        ],
        cacheRecommendations: [
          {
            title: "Move policy text before dynamic conversation context",
            detail: "The static policy block can become a larger cacheable prefix.",
            impact: "high",
            estimatedMonthlySavings: 420,
          },
        ],
        failureClusters: [
          {
            label: "Escalation misses",
            severity: "high",
            issueCount: 1,
            percent: 100,
          },
        ],
        report: {
          title: "Eval Debt Audit Report",
          summary: "The workflow has a high-risk escalation gap.",
          readinessScore: 62,
          recommendations: ["Fix escalation handoff behavior before expanding traffic."],
        },
      },
    });

    expect(result.evalCases).toEqual([
      expect.objectContaining({
        intent: "Escalation",
        status: "failed",
        source: "production",
      }),
    ]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        evalCaseId: result.evalCases[0].id,
        status: "open",
        severity: "high",
      }),
    ]);
    expect(result.promptCandidates).toHaveLength(1);
    expect(result.routingRules).toHaveLength(1);
    expect(result.cacheRecommendations).toHaveLength(1);
    expect(result.failureClusters).toHaveLength(1);
    expect(result.report.readinessScore).toBe(62);
  });

  it("builds a privacy-safe prompt from redacted trace fields", () => {
    const prompt = buildOpenAIAuditPrompt({
      project: buildProject(),
      traces: [
        {
          ...buildTrace(),
          input: "My email is founder@example.com and I need a refund.",
          output: "I can help.",
          redactedInput: "My email is [email] and I need a refund.",
          redactedOutput: "I can help.",
          redactionHits: ["email"],
        },
      ],
    });

    expect(prompt).toContain("[email]");
    expect(prompt).not.toContain("founder@example.com");
  });
});

function buildProject(): Project {
  return {
    id: "project_1",
    organizationId: "org_1",
    name: "Support Assistant Audit",
    workflowType: "support_assistant",
    objective: "Improve escalation quality.",
    riskPreferences: ["Escalation"],
    privacyMode: "redact_pii",
    status: "active",
    createdAt: "2026-05-03T12:00:00.000Z",
    updatedAt: "2026-05-03T12:00:00.000Z",
  };
}

function buildTrace(): NormalizedTrace & { id: string } {
  return {
    id: "trace_1",
    externalId: "c_1",
    sourceType: "CSV",
    input: "I asked three times and this is still not fixed",
    output: "Try restarting the app.",
    redactedInput: "I asked three times and this is still not fixed",
    redactedOutput: "Try restarting the app.",
    redactionHits: [],
    intent: "Escalation",
    riskLevel: "high",
    occurredAt: "2026-05-03T12:00:00.000Z",
    metadata: {},
  };
}
