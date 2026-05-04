import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { ApiError } from "@/lib/server/auth";
import { isTestMode } from "@/lib/server/env";
import { logServerEvent } from "@/lib/server/logger";
import {
  buildFallbackFailurePatterns,
  buildFallbackPromptSuggestion,
  mapAiOutputToStoredArtifacts,
} from "./logic";
import type {
  EvallerAiRunOutput,
  EvallerPromptVersion,
  EvallerScenario,
  EvallerSuccessCriterion,
} from "./types";

const evallerAiRunOutputSchema = z.object({
  results: z.array(
    z.object({
      scenarioId: z.string().min(1),
      assistantResponse: z.string().min(1),
      score: z.number().min(0).max(100),
      passedCriteria: z.array(z.string().min(1)),
      failedCriteria: z.array(z.string().min(1)),
      rationale: z.string().min(1),
    }),
  ),
  failurePatterns: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      failedCriteria: z.array(z.string().min(1)),
      scenarioIds: z.array(z.string().min(1)),
      severity: z.enum(["low", "medium", "high"]),
    }),
  ),
  promptSuggestions: z.array(
    z.object({
      title: z.string().min(1),
      explanation: z.string().min(1),
      patch: z.string().min(1),
      revisedInstructions: z.string().min(1),
      affectedCriteria: z.array(z.string().min(1)),
    }),
  ),
});

type ResponsesClient = {
  responses: {
    parse: (request: {
      model: string;
      input: Array<{ role: "system" | "user"; content: string }>;
      text: { format: unknown };
      store: false;
    }) => Promise<{
      output_parsed: EvallerAiRunOutput | null;
    }>;
  };
};

export async function runEvallerAiTest(input: {
  aiTestName: string;
  aiTestDescription: string;
  promptVersion: EvallerPromptVersion;
  scenarios: EvallerScenario[];
  successCriteria: EvallerSuccessCriterion[];
  qualityBar: number;
  runId: string;
  aiTestId: string;
  organizationId: string;
  now: string;
  makeId: (prefix: string) => string;
  client?: ResponsesClient;
  correlationId?: string;
}) {
  const output = await generateEvallerAiOutput(input);
  const mapped = mapAiOutputToStoredArtifacts({
    output,
    runId: input.runId,
    aiTestId: input.aiTestId,
    organizationId: input.organizationId,
    scenarios: input.scenarios,
    criteria: input.successCriteria,
    qualityBar: input.qualityBar,
    now: input.now,
    makeId: input.makeId,
  });

  const failurePatterns = mapped.failurePatterns.length
    ? mapped.failurePatterns
    : buildFallbackFailurePatterns({
        runId: input.runId,
        aiTestId: input.aiTestId,
        organizationId: input.organizationId,
        results: mapped.results,
        now: input.now,
        makeId: input.makeId,
      });

  const promptSuggestions = mapped.promptSuggestions.length
    ? mapped.promptSuggestions
    : buildFallbackPromptSuggestion({
        instructions: input.promptVersion.instructions,
        runId: input.runId,
        aiTestId: input.aiTestId,
        organizationId: input.organizationId,
        results: mapped.results,
        now: input.now,
        makeId: input.makeId,
      });

  return {
    ...mapped,
    failurePatterns,
    promptSuggestions,
  };
}

async function generateEvallerAiOutput(input: {
  aiTestName: string;
  aiTestDescription: string;
  promptVersion: EvallerPromptVersion;
  scenarios: EvallerScenario[];
  successCriteria: EvallerSuccessCriterion[];
  qualityBar: number;
  runId: string;
  client?: ResponsesClient;
  correlationId?: string;
}): Promise<EvallerAiRunOutput> {
  if (isTestMode() && !input.client) {
    return deterministicAiOutput(input);
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ApiError(
      503,
      "OpenAI is not configured for AI test runs. Add a server-side OPENAI_API_KEY before running tests.",
      "openai_not_configured",
    );
  }

  const model = process.env.OPENAI_EVALLER_MODEL?.trim() || process.env.OPENAI_AUDIT_MODEL?.trim();
  if (!model) {
    throw new ApiError(
      503,
      "OpenAI model configuration is missing for AI test runs. Set OPENAI_EVALLER_MODEL before running tests.",
      "openai_model_not_configured",
    );
  }
  const client = input.client || (new OpenAI({ apiKey }) as unknown as ResponsesClient);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await client.responses.parse({
        model,
        input: [
          {
            role: "system",
            content:
              "You run product-friendly AI quality tests. First simulate the tested support AI using the provided instructions and user scenarios. Then grade each simulated response against the success criteria. Return structured JSON only.",
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                aiFeature: {
                  name: input.aiTestName,
                  description: input.aiTestDescription,
                  qualityBar: input.qualityBar,
                },
                testedInstructions: input.promptVersion.instructions,
                userScenarios: input.scenarios.map((scenario) => ({
                  id: scenario.id,
                  title: scenario.title,
                  message: scenario.message,
                  expectedBehavior: scenario.expectedBehavior,
                })),
                successCriteria: input.successCriteria.map((criterion) => criterion.text),
                instructions: [
                  "Generate one assistant response per user scenario using only the tested instructions.",
                  "Grade each assistant response against every success criterion.",
                  "A scenario should score below the quality bar if important criteria are missing.",
                  "Group repeated failures into plain-language failure patterns.",
                  "Suggest concrete prompt fixes. revisedInstructions must be the full revised prompt, not a diff.",
                  "Do not invent customer secrets or claim external actions were completed.",
                ],
              },
              null,
              2,
            ),
          },
        ],
        text: {
          format: zodTextFormat(evallerAiRunOutputSchema, "evaller_ai_test_run"),
        },
        store: false,
      });

      if (!response.output_parsed) {
        throw new Error("OpenAI did not return structured AI test results.");
      }

      return response.output_parsed;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const transient = isTransientOpenAiError(error);
      logServerEvent(transient && attempt === 1 ? "warn" : "error", "evaller.openai_run_failed", {
        correlationId: input.correlationId,
        runId: input.runId,
        model,
        attempt,
        maxAttempts: 2,
        transient,
        error: sanitizeOpenAiError(error),
      });
      if (transient && attempt === 1) {
        continue;
      }
      throw new ApiError(
        502,
        "The AI test run failed while calling OpenAI. Please try again.",
        "openai_run_failed",
      );
    }
  }

  throw new ApiError(502, "The AI test run failed while calling OpenAI. Please try again.", "openai_run_failed");
}

function isTransientOpenAiError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status) : 0;
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  return status === 408 || status === 409 || status === 429 || status >= 500 || /rate|timeout|temporar|overload/i.test(code);
}

function sanitizeOpenAiError(error: unknown) {
  if (!(error instanceof Error)) {
    return { name: "UnknownError", message: "Unknown OpenAI error." };
  }
  const extra = error as Error & { status?: unknown; code?: unknown; type?: unknown };
  return {
    name: error.name,
    message: error.message,
    status: typeof extra.status === "number" ? extra.status : undefined,
    code: typeof extra.code === "string" ? extra.code : undefined,
    type: typeof extra.type === "string" ? extra.type : undefined,
  };
}

function deterministicAiOutput(input: {
  promptVersion: EvallerPromptVersion;
  scenarios: EvallerScenario[];
  successCriteria: EvallerSuccessCriterion[];
}): EvallerAiRunOutput {
  const prompt = input.promptVersion.instructions.toLowerCase();
  const improved =
    prompt.includes("human handoff") &&
    prompt.includes("acknowledge") &&
    (prompt.includes("unsupported") || prompt.includes("policy boundaries"));

  const results = input.scenarios.map((scenario) => {
    const message = scenario.message.toLowerCase();
    const response = deterministicAssistantResponse(prompt, message, improved);
    const passedCriteria = input.successCriteria
      .map((criterion) => criterion.text)
      .filter((criterion) => deterministicCriterionPass(criterion, response, improved));
    const failedCriteria = input.successCriteria
      .map((criterion) => criterion.text)
      .filter((criterion) => !passedCriteria.includes(criterion));
    const score = Math.round((passedCriteria.length / Math.max(1, input.successCriteria.length)) * 100);

    return {
      scenarioId: scenario.id,
      assistantResponse: response,
      score,
      passedCriteria,
      failedCriteria,
      rationale: failedCriteria.length
        ? `The response missed ${failedCriteria.join("; ")}.`
        : "The response satisfied the configured support quality criteria.",
    };
  });

  const failedCriteria = Array.from(new Set(results.flatMap((result) => result.failedCriteria)));
  return {
    results,
    failurePatterns: failedCriteria.map((criterion) => ({
      title: `Missing ${criterion.toLowerCase()}`,
      description: "One or more scenarios missed this success criterion.",
      failedCriteria: [criterion],
      scenarioIds: results
        .filter((result) => result.failedCriteria.includes(criterion))
        .map((result) => result.scenarioId),
      severity: "medium" as const,
    })),
    promptSuggestions: failedCriteria.length && !improved
      ? [
          {
            title: "Add explicit support handoff and safety rules",
            explanation: "The prompt needs clearer behavior for frustration, escalation, and unsupported account actions.",
            patch: [
              "Acknowledge user frustration or urgency before solving.",
              "Offer a human handoff for billing, privacy, deletion, escalation, or urgent demo-blocking issues.",
              "State policy boundaries clearly and avoid promising unsupported actions.",
              "Ask one clarifying question when the safest next step depends on missing account details.",
            ].join("\n"),
            revisedInstructions: `${input.promptVersion.instructions.trim()}\n\nEvaller improvement:\n- Acknowledge user frustration or urgency before solving.\n- Offer a human handoff for billing, privacy, deletion, escalation, or urgent demo-blocking issues.\n- State policy boundaries clearly and avoid promising unsupported actions.\n- Ask one clarifying question when the safest next step depends on missing account details.`,
            affectedCriteria: failedCriteria,
          },
        ]
      : [],
  };
}

function deterministicAssistantResponse(prompt: string, message: string, improved: boolean) {
  const isBilling = /billing|charged|refund|invoice/.test(message);
  const isPrivacy = /delete|privacy|data/.test(message);
  const isUrgent = /urgent|tomorrow|demo|frustrating|stuck|broken/.test(message);

  if (!improved) {
    return "I can help with that. Please check your account settings and try the standard troubleshooting steps.";
  }

  const parts = [
    isUrgent
      ? "I understand this is urgent and frustrating."
      : "I understand why you want this handled carefully.",
  ];

  if (isBilling) {
    parts.push("I can review the billing issue with you, but I should not promise a refund until the account details are verified.");
  } else if (isPrivacy) {
    parts.push("For deletion requests, I can guide you to the privacy process but should not claim the data is deleted until the verified workflow completes.");
  } else {
    parts.push("Can you share the step where setup fails so we can isolate the safest next action?");
  }

  parts.push("If this blocks you or touches billing, privacy, or account access, I can route you to a human support specialist.");
  if (prompt.includes("concise")) parts.push("Here is the shortest safe next step: confirm the account email and the exact error or charge.");
  return parts.join(" ");
}

function deterministicCriterionPass(criterion: string, response: string, improved: boolean) {
  const lower = criterion.toLowerCase();
  const answer = response.toLowerCase();
  if (!improved) return lower.includes("safe and accurate") && answer.includes("help");
  if (lower.includes("frustration") || lower.includes("urgency")) {
    return answer.includes("understand") && (answer.includes("urgent") || answer.includes("frustrating") || answer.includes("carefully"));
  }
  if (lower.includes("human") || lower.includes("handoff")) {
    return answer.includes("human") || answer.includes("specialist");
  }
  if (lower.includes("unsupported") || lower.includes("promise")) {
    return !hasUnsafeActionPromise(answer);
  }
  if (lower.includes("safe") || lower.includes("accurate")) {
    return answer.includes("verified") || answer.includes("safest") || answer.includes("safe");
  }
  return true;
}

function hasUnsafeActionPromise(answer: string) {
  return [
    /\b(i|we)\s+(will|can|have|just)\s+(refund|delete|remove|close|cancel|fix|change|update|access)\b/,
    /\b(refund|deletion|account change|cancellation)\s+(is|has been|will be)\s+(complete|completed|done|processed|approved)\b/,
    /\byour\s+(data|account|charge|invoice|subscription)\s+(is|has been|will be)\s+(deleted|removed|fixed|refunded|cancelled|canceled)\b/,
  ].some((pattern) => pattern.test(answer));
}
