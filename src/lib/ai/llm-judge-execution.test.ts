import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLLMJudgePrompt, executeLLMJudgeGrader, type LLMJudgeResponsesClient } from "./llm-judge-execution";
import type { StoredEvalCase, StoredGrader, StoredTrace } from "@/lib/server/types";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("LLM judge execution", () => {
  it("requires OpenAI judge configuration outside explicit test mode", async () => {
    vi.stubEnv("EVALOPS_TEST_MODE", "0");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_AUDIT_MODEL", "");

    await expect(
      executeLLMJudgeGrader({
        evalCase: buildEvalCase(),
        grader: buildGrader(),
        trace: buildTrace(),
        evalRunId: "run_1",
        now: "2026-05-03T12:00:00.000Z",
        client: buildClient(),
      }),
    ).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it("uses Responses parse with structured output, no storage, and redacted trace text", async () => {
    vi.stubEnv("EVALOPS_TEST_MODE", "0");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_AUDIT_MODEL", "gpt-5.5-mini");
    const client = buildClient({
      score: 84,
      rationale: "The answer acknowledges the user and offers a clear human handoff.",
      evidenceQuotes: ["I can create a support ticket for a human agent."],
      confidence: 0.86,
    });

    const result = await executeLLMJudgeGrader({
      evalCase: buildEvalCase(),
      grader: buildGrader(),
      trace: buildTrace({
        output: "Email founder@example.com. I can create a support ticket for a human agent.",
        redactedOutput: "[email]. I can create a support ticket for a human agent.",
      }),
      evalRunId: "run_1",
      promptVersionId: "prompt_1",
      now: "2026-05-03T12:00:00.000Z",
      client,
    });

    expect(client.responses.parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.5-mini",
        store: false,
        text: expect.objectContaining({
          format: expect.any(Object),
        }),
      }),
    );
    const request = vi.mocked(client.responses.parse).mock.calls[0][0];
    const userMessage = request.input[1];

    expect(userMessage.content).toContain("[email]");
    expect(userMessage.content).not.toContain("founder@example.com");
    expect(result).toEqual(
      expect.objectContaining({
        status: "passed",
        score: 84,
        model: "gpt-5.5-mini",
        confidence: 0.86,
        promptVersionId: "prompt_1",
      }),
    );
    expect(result.tokenUsage).toEqual({ input_tokens: 10, output_tokens: 5, total_tokens: 15 });
  });

  it("falls back deterministically only in explicit test mode", async () => {
    vi.stubEnv("EVALOPS_TEST_MODE", "1");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_AUDIT_MODEL", "");

    const result = await executeLLMJudgeGrader({
      evalCase: buildEvalCase(),
      grader: buildGrader({ passThreshold: 0.8, reviewThreshold: 0.6 }),
      trace: buildTrace({
        redactedOutput: "I understand this is frustrating. I can create a support ticket for a human agent.",
      }),
      evalRunId: "run_1",
      now: "2026-05-03T12:00:00.000Z",
    });

    expect(result.status).toBe("passed");
    expect(result.model).toBe("deterministic-test-mode");
  });

  it("builds a prompt from redacted trace fields", () => {
    const prompt = buildLLMJudgePrompt({
      evalCase: buildEvalCase(),
      grader: buildGrader(),
      trace: buildTrace({
        input: "My email is founder@example.com and I need a person.",
        output: "Email founder@example.com.",
        redactedInput: "My email is [email] and I need a person.",
        redactedOutput: "Email [email].",
      }),
    });

    expect(prompt).toContain("[email]");
    expect(prompt).not.toContain("founder@example.com");
  });
});

function buildClient(output = {
  score: 72,
  rationale: "The response partially follows the rubric.",
  evidenceQuotes: ["I can help."],
  confidence: 0.7,
}): LLMJudgeResponsesClient {
  return {
    responses: {
      parse: vi.fn().mockResolvedValue({
        id: "resp_1",
        output_parsed: output,
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      }),
    },
  } as unknown as LLMJudgeResponsesClient;
}

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
    acceptanceCriteria: ["Acknowledges frustration", "Creates or offers human handoff"],
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
    type: "llm_judge",
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
