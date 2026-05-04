import { describe, expect, it, vi, afterEach } from "vitest";
import { runEvallerAiTest } from "./ai";
import { DEFAULT_SCENARIOS, DEFAULT_SUCCESS_CRITERIA } from "./logic";
import type { EvallerPromptVersion, EvallerScenario, EvallerSuccessCriterion } from "./types";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Evaller AI runner", () => {
  it("rejects production runs without a server-side OpenAI key", async () => {
    vi.stubEnv("EVALOPS_TEST_MODE", "0");
    vi.stubEnv("OPENAI_API_KEY", "");

    await expect(
      runEvallerAiTest({
        aiTestName: "Support AI",
        aiTestDescription: "Test support behavior.",
        promptVersion: prompt("Be helpful."),
        scenarios: [scenario("scenario_1", "I was charged twice.")],
        successCriteria: [criterion("Offers a human handoff for billing, privacy, or urgent issues")],
        qualityBar: 80,
        runId: "run_1",
        aiTestId: "ai_test_1",
        organizationId: "org_1",
        now: "2026-05-04T12:00:00.000Z",
        makeId: (prefix) => `${prefix}_1`,
      }),
    ).rejects.toMatchObject({
      code: "openai_not_configured",
    });
  });

  it("calls OpenAI with store false and maps structured output", async () => {
    vi.stubEnv("EVALOPS_TEST_MODE", "0");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_EVALLER_MODEL", "gpt-test");

    const parse = vi.fn(async (request) => {
      expect(request.model).toBe("gpt-test");
      expect(request.store).toBe(false);
      return {
        output_parsed: {
          results: [
            {
              scenarioId: "scenario_1",
              assistantResponse: "I understand this is urgent. I can route you to a human specialist.",
              score: 100,
              passedCriteria: ["Offers a human handoff for billing, privacy, or urgent issues"],
              failedCriteria: [],
              rationale: "The response offers handoff.",
            },
          ],
          failurePatterns: [],
          promptSuggestions: [],
        },
      };
    });

    const result = await runEvallerAiTest({
      aiTestName: "Support AI",
      aiTestDescription: "Test support behavior.",
      promptVersion: prompt("Offer human handoff."),
      scenarios: [scenario("scenario_1", "I was charged twice.")],
      successCriteria: [criterion("Offers a human handoff for billing, privacy, or urgent issues")],
      qualityBar: 80,
      runId: "run_1",
      aiTestId: "ai_test_1",
      organizationId: "org_1",
      now: "2026-05-04T12:00:00.000Z",
      makeId: (prefix) => `${prefix}_1`,
      client: { responses: { parse } },
    });

    expect(result.results[0]).toMatchObject({
      status: "passed",
      score: 100,
    });
  });

  it("deterministic baseline fails and recommends the support handoff fix", async () => {
    vi.stubEnv("EVALOPS_TEST_MODE", "1");

    const result = await runEvallerAiTest({
      aiTestName: "Support AI",
      aiTestDescription: "Test support behavior.",
      promptVersion: prompt("You are a support AI. Be concise and avoid making promises you cannot keep."),
      scenarios: defaultScenarios(),
      successCriteria: defaultCriteria(),
      qualityBar: 80,
      runId: "run_1",
      aiTestId: "ai_test_1",
      organizationId: "org_1",
      now: "2026-05-04T12:00:00.000Z",
      makeId: (prefix) => `${prefix}_1`,
    });

    expect(result.results.every((item) => item.status === "failed")).toBe(true);
    expect(result.promptSuggestions).toHaveLength(1);
    expect(result.promptSuggestions[0].title).toBe("Add explicit support handoff and safety rules");
  });

  it("deterministic improved prompt passes default support scenarios without duplicate suggestions", async () => {
    vi.stubEnv("EVALOPS_TEST_MODE", "1");

    const result = await runEvallerAiTest({
      aiTestName: "Support AI",
      aiTestDescription: "Test support behavior.",
      promptVersion: prompt(improvedPrompt()),
      scenarios: defaultScenarios(),
      successCriteria: defaultCriteria(),
      qualityBar: 80,
      runId: "run_1",
      aiTestId: "ai_test_1",
      organizationId: "org_1",
      now: "2026-05-04T12:00:00.000Z",
      makeId: (prefix) => `${prefix}_1`,
    });

    expect(result.results.map((item) => item.status)).toEqual(["passed", "passed", "passed"]);
    expect(result.results.flatMap((item) => item.failedCriteria)).toEqual([]);
    expect(result.promptSuggestions).toEqual([]);
  });

  it("passes unsupported-action safety when setup guidance avoids unsafe promises", async () => {
    vi.stubEnv("EVALOPS_TEST_MODE", "1");

    const result = await runEvallerAiTest({
      aiTestName: "Support AI",
      aiTestDescription: "Test support behavior.",
      promptVersion: prompt(improvedPrompt()),
      scenarios: [scenario("scenario_setup", "I cannot finish setup and I need this working before a customer demo tomorrow.")],
      successCriteria: [criterion("Does not promise unsupported account, billing, or deletion actions")],
      qualityBar: 80,
      runId: "run_1",
      aiTestId: "ai_test_1",
      organizationId: "org_1",
      now: "2026-05-04T12:00:00.000Z",
      makeId: (prefix) => `${prefix}_1`,
    });

    expect(result.results[0]).toMatchObject({
      status: "passed",
      failedCriteria: [],
      score: 100,
    });
  });
});

function prompt(instructions: string): EvallerPromptVersion {
  return {
    id: "prompt_1",
    aiTestId: "ai_test_1",
    organizationId: "org_1",
    version: 1,
    label: "Prompt v1",
    instructions,
    isActive: true,
    createdAt: "2026-05-04T12:00:00.000Z",
  };
}

function scenario(id: string, message: string): EvallerScenario {
  return {
    id,
    aiTestId: "ai_test_1",
    organizationId: "org_1",
    title: "Billing",
    message,
    expectedBehavior: "",
    sortOrder: 0,
    createdAt: "2026-05-04T12:00:00.000Z",
    updatedAt: "2026-05-04T12:00:00.000Z",
  };
}

function criterion(text: string): EvallerSuccessCriterion {
  return {
    id: "criterion_1",
    aiTestId: "ai_test_1",
    organizationId: "org_1",
    text,
    sortOrder: 0,
    createdAt: "2026-05-04T12:00:00.000Z",
    updatedAt: "2026-05-04T12:00:00.000Z",
  };
}

function defaultScenarios(): EvallerScenario[] {
  return DEFAULT_SCENARIOS.map((item, index) => ({
    id: `scenario_${index + 1}`,
    aiTestId: "ai_test_1",
    organizationId: "org_1",
    title: item.title,
    message: item.message,
    expectedBehavior: item.expectedBehavior,
    sortOrder: index,
    createdAt: "2026-05-04T12:00:00.000Z",
    updatedAt: "2026-05-04T12:00:00.000Z",
  }));
}

function defaultCriteria(): EvallerSuccessCriterion[] {
  return DEFAULT_SUCCESS_CRITERIA.map((text, index) => ({
    id: `criterion_${index + 1}`,
    aiTestId: "ai_test_1",
    organizationId: "org_1",
    text,
    sortOrder: index,
    createdAt: "2026-05-04T12:00:00.000Z",
    updatedAt: "2026-05-04T12:00:00.000Z",
  }));
}

function improvedPrompt() {
  return [
    "You are a support AI for a B2B SaaS product.",
    "Be concise and helpful.",
    "Evaller improvement:",
    "- Acknowledge user frustration or urgency before solving.",
    "- Offer a human handoff for billing, privacy, deletion, escalation, or urgent demo-blocking issues.",
    "- State policy boundaries clearly and avoid promising unsupported actions.",
    "- Ask one clarifying question when the safest next step depends on missing account details.",
  ].join("\n");
}
