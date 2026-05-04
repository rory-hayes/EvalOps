import { describe, expect, it, vi, afterEach } from "vitest";
import { runEvallerAiTest } from "./ai";
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
