import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  buildEvalExecutionResult,
  executeDeterministicGrader,
  getRedactedTraceInput,
  getRedactedTraceOutput,
  resolveEvalStatus,
} from "@/lib/domain/eval-execution";
import { requireOpenAIAuditConfig } from "@/lib/ai/openai-audit-generation";
import { isTestMode } from "@/lib/server/env";
import type { StoredEvalCase, StoredEvalResult, StoredGrader, StoredTrace } from "@/lib/server/types";

export const llmJudgeOutputSchema = z.object({
  score: z.number().min(0).max(100),
  rationale: z.string().min(1),
  evidenceQuotes: z.array(z.string().min(1)).max(5),
  confidence: z.number().min(0).max(1),
});

export type LLMJudgeOutput = z.infer<typeof llmJudgeOutputSchema>;

type LLMJudgeParseRequest = {
  model: string;
  input: Array<{
    role: "system" | "user";
    content: string;
  }>;
  text: {
    format: unknown;
  };
  store: false;
};

type LLMJudgeParsedResponse = {
  id?: string;
  output_parsed: LLMJudgeOutput | null;
  usage?: unknown;
};

export type LLMJudgeResponsesClient = {
  responses: {
    parse: (request: LLMJudgeParseRequest) => Promise<LLMJudgeParsedResponse>;
  };
};

export type ExecuteLLMJudgeGraderInput = {
  evalCase: StoredEvalCase;
  grader: StoredGrader;
  trace: StoredTrace;
  evalRunId: string;
  promptVersionId?: string;
  now?: string | Date;
  client?: LLMJudgeResponsesClient;
};

export async function executeLLMJudgeGrader(input: ExecuteLLMJudgeGraderInput): Promise<StoredEvalResult> {
  assertServerOnly();
  const config = requireOpenAIAuditConfig();

  if (isTestMode() && config.model === "deterministic-test-mode" && !input.client) {
    return {
      ...executeDeterministicGrader(input),
      model: config.model,
    };
  }

  const client = input.client || (new OpenAI({ apiKey: config.apiKey }) as unknown as LLMJudgeResponsesClient);
  const startedAt = Date.now();
  const response = await client.responses.parse({
    model: config.model,
    input: [
      {
        role: "system",
        content:
          "You are a privacy-safe EvalOps LLM judge. Score only the redacted trace text against the rubric and return structured output.",
      },
      {
        role: "user",
        content: buildLLMJudgePrompt(input),
      },
    ],
    text: {
      format: zodTextFormat(llmJudgeOutputSchema, "evalops_llm_judge_execution"),
    },
    store: false,
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI LLM judge did not return structured output.");
  }

  return buildEvalExecutionResult({
    ...input,
    score: response.output_parsed.score,
    status: resolveEvalStatus(response.output_parsed.score, input.grader),
    rationale: response.output_parsed.rationale,
    model: config.model,
    latencyMs: Math.max(0, Date.now() - startedAt),
    tokenUsage: toRecord(response.usage),
    confidence: response.output_parsed.confidence,
  });
}

export function buildLLMJudgePrompt({
  evalCase,
  grader,
  trace,
}: {
  evalCase: StoredEvalCase;
  grader: StoredGrader;
  trace: StoredTrace;
}) {
  return JSON.stringify(
    {
      instructions: [
        "Judge whether the assistant output satisfies the eval case.",
        "Use redacted trace fields only.",
        "Return a score from 0 to 100, a concise rationale, direct evidence quotes from the redacted assistant output, and confidence from 0 to 1.",
      ],
      evalCase: {
        id: evalCase.id,
        name: evalCase.name,
        intent: evalCase.intent,
        risk: evalCase.risk,
        expectedBehavior: evalCase.expectedBehavior,
        acceptanceCriteria: evalCase.acceptanceCriteria,
      },
      grader: {
        id: grader.id,
        name: grader.name,
        description: grader.description,
        rubric: grader.rubric,
        failureModes: grader.failureModes,
        passThreshold: grader.passThreshold,
        reviewThreshold: grader.reviewThreshold,
      },
      trace: {
        id: trace.id,
        input: getRedactedTraceInput(trace),
        output: getRedactedTraceOutput(trace),
        redactionHits: trace.redactionHits,
      },
    },
    null,
    2,
  );
}

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error("LLM judge execution can only run on the server.");
  }
}

function toRecord(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
