import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { buildEvalArtifacts, type GeneratedArtifacts, type NormalizedTrace } from "@/lib/domain/trace-processing";
import { isTestMode } from "@/lib/server/env";
import type {
  CacheRecommendation,
  FailureCluster,
  Project,
  PromptCandidate,
  RoutingRule,
} from "@/lib/server/types";

const generatedCaseSchema = z.object({
  name: z.string().min(1),
  intent: z.string().min(1),
  set: z.enum(["golden", "regression", "edge", "safety"]),
  sourceTraceId: z.string().optional(),
  userInput: z.string().min(1),
  expectedBehavior: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  risk: z.enum(["low", "medium", "high"]),
  grader: z.string().min(1),
  lastResult: z.number().min(0).max(100),
  status: z.enum(["passed", "failed", "review"]),
  source: z.enum(["production", "synthetic", "requirements", "known_failure"]),
});

const evidenceRefSchema = z.object({
  entityType: z.enum([
    "trace",
    "trace_import",
    "eval_case",
    "grader",
    "eval_run",
    "eval_result",
    "human_label",
    "calibration_result",
    "issue",
    "prompt_candidate",
    "routing_rule",
    "cache_recommendation",
    "report",
  ]),
  entityId: z.string().min(1),
  label: z.string().min(1),
  excerpt: z.string().min(1).optional(),
});

const evidenceFieldsSchema = z.object({
  confidence: z.number().min(0).max(1).optional(),
  evidenceRefs: z.array(evidenceRefSchema).optional(),
  calculationBasis: z.string().min(1).optional(),
});

export const openAIAuditOutputSchema = z.object({
  cases: z.array(generatedCaseSchema).min(1).max(80),
  issues: z.array(
    z.object({
      evalCaseName: z.string().min(1),
      title: z.string().min(1),
      severity: z.enum(["low", "medium", "high"]),
      description: z.string().min(1),
    }),
  ),
  graders: z.array(
    z.object({
      name: z.string().min(1),
      type: z.enum(["deterministic", "llm_judge"]),
      description: z.string().min(1),
      health: z.enum(["healthy", "low_agreement", "review"]),
      agreement: z.number().min(0).max(1),
      model: z.string().optional(),
    }),
  ).min(1),
  promptCandidates: z.array(
    z.object({
      title: z.string().min(1),
      promptBody: z.string().min(1),
      sourcePromptVersionId: z.string().min(1).optional(),
      diffSummary: z.string().min(1).optional(),
      expectedQualityLift: z.number(),
      expectedCostDelta: z.number(),
      expectedLatencyDeltaMs: z.number().optional(),
      baselinePassRate: z.number().min(0).max(100).optional(),
      candidatePassRate: z.number().min(0).max(100).optional(),
      regressionRisk: z.enum(["low", "medium", "high"]),
      explanation: z.string().min(1),
      confidence: z.number().min(0).max(1).optional(),
      evidenceRefs: z.array(evidenceRefSchema).optional(),
    }),
  ),
  routingRules: z.array(
    z.object({
      intent: z.string().min(1),
      model: z.string().min(1),
      fallback: z.string().min(1),
      qualityScore: z.number().min(0).max(100),
      estimatedCost: z.number().min(0),
      estimatedLatencyMs: z.number().int().min(0),
      trafficShare: z.number().min(0).max(100),
    }).merge(evidenceFieldsSchema),
  ),
  cacheRecommendations: z.array(
    z.object({
      title: z.string().min(1),
      detail: z.string().min(1),
      impact: z.enum(["low", "medium", "high"]),
      estimatedMonthlySavings: z.number().min(0),
    }).merge(evidenceFieldsSchema),
  ),
  failureClusters: z.array(
    z.object({
      label: z.string().min(1),
      severity: z.enum(["low", "medium", "high"]),
      issueCount: z.number().int().min(0),
      percent: z.number().min(0).max(100),
    }),
  ),
  report: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    readinessScore: z.number().min(0).max(100),
    recommendations: z.array(z.string().min(1)).min(1),
  }),
});

export type OpenAIAuditOutput = z.infer<typeof openAIAuditOutputSchema>;

export type AuditArtifacts = GeneratedArtifacts & {
  promptCandidates?: Array<Omit<PromptCandidate, "id" | "organizationId" | "projectId" | "createdAt">>;
  routingRules?: Array<Omit<RoutingRule, "id" | "organizationId" | "projectId" | "createdAt">>;
  cacheRecommendations?: Array<Omit<CacheRecommendation, "id" | "organizationId" | "projectId" | "createdAt">>;
  failureClusters?: Array<Omit<FailureCluster, "id" | "organizationId" | "projectId" | "createdAt">>;
  generationMetadata?: {
    provider: "openai" | "deterministic";
    model?: string;
    responseId?: string;
    schemaName: string;
    tokenUsage?: Record<string, unknown>;
  };
};

export function requireOpenAIAuditConfig() {
  if (isTestMode()) {
    return { apiKey: "test-mode", model: "deterministic-test-mode" };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for production audit generation.");
  }

  const model = process.env.OPENAI_AUDIT_MODEL?.trim();
  if (!model) {
    throw new Error("OPENAI_AUDIT_MODEL is required for production audit generation.");
  }

  return { apiKey, model };
}

export async function generateAuditArtifacts({
  project,
  traces,
}: {
  project: Project;
  traces: Array<NormalizedTrace & { id?: string }>;
}): Promise<AuditArtifacts> {
  if (isTestMode()) {
    return {
      ...buildEvalArtifacts({ projectId: project.id, traces }),
      generationMetadata: { provider: "deterministic", schemaName: "deterministic_trace_processing" },
    };
  }

  return generateOpenAIAuditArtifacts({ project, traces });
}

export async function generateOpenAIAuditArtifacts({
  project,
  traces,
}: {
  project: Project;
  traces: Array<NormalizedTrace & { id?: string }>;
}): Promise<AuditArtifacts> {
  const config = requireOpenAIAuditConfig();
  const client = new OpenAI({ apiKey: config.apiKey });
  const schemaName = "evalops_audit_generation";
  const response = await client.responses.parse({
    model: config.model,
    input: [
      {
        role: "system",
        content:
          "You generate privacy-safe Eval Debt Audit artifacts. Use only redacted trace text, keep outputs concrete, and return structured data that fits the schema.",
      },
      {
        role: "user",
        content: buildOpenAIAuditPrompt({ project, traces }),
      },
    ],
    text: {
      format: zodTextFormat(openAIAuditOutputSchema, schemaName),
    },
    store: false,
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI audit generation did not return structured output.");
  }

  return {
    ...mapParsedAuditOutput({
      project,
      traces,
      output: response.output_parsed,
      generatedAt: new Date().toISOString(),
    }),
    generationMetadata: {
      provider: "openai",
      model: config.model,
      responseId: response.id,
      schemaName,
      tokenUsage: response.usage ? JSON.parse(JSON.stringify(response.usage)) as Record<string, unknown> : undefined,
    },
  };
}

export function buildOpenAIAuditPrompt({
  project,
  traces,
}: {
  project: Project;
  traces: Array<NormalizedTrace & { id?: string }>;
}) {
  const traceSamples = traces.slice(0, 100).map((trace, index) => ({
    id: trace.id || trace.externalId || `trace_${index + 1}`,
    sourceType: trace.sourceType,
    intent: trace.intent,
    riskLevel: trace.riskLevel,
    input: trace.redactedInput,
    output: trace.redactedOutput,
    redactionHits: trace.redactionHits,
  }));

  return JSON.stringify(
    {
      project: {
        name: project.name,
        workflowType: project.workflowType,
        objective: project.objective,
        riskPreferences: project.riskPreferences,
        privacyMode: project.privacyMode,
      },
      instructions: [
        "Generate an Eval Debt Audit for these traces.",
        "Use redacted input and output only.",
        "Create starter eval cases, review issues, grader definitions, prompt candidates, routing rules, cache recommendations, failure clusters, and an executive report.",
        "Tie recommendations to quality, cost, latency, and regression risk where possible.",
        "Generate evidence-backed prompt candidates with promptBody as the complete candidate prompt, sourcePromptVersionId when known, diffSummary, confidence from 0 to 1, and evidenceRefs pointing to supporting traces, eval cases, or issues.",
        "Include evidenceRefs, confidence, and calculationBasis on routing rules and cache recommendations whenever the traces support the recommendation.",
      ],
      traces: traceSamples,
    },
    null,
    2,
  );
}

export function mapParsedAuditOutput({
  project,
  output,
}: {
  project: Project;
  traces: Array<NormalizedTrace & { id?: string }>;
  output: OpenAIAuditOutput;
  generatedAt: string;
}): AuditArtifacts {
  const evalCases = output.cases.map((item, index) => ({
    id: makeStableId("case", project.id, item.name, index),
    name: item.name,
    set: item.set,
    intent: item.intent,
    source: item.source,
    risk: item.risk,
    grader: item.grader,
    lastResult: Math.round(item.lastResult),
    status: item.status,
    userInput: item.userInput,
    expectedBehavior: item.expectedBehavior,
    acceptanceCriteria: item.acceptanceCriteria,
  }));
  const caseByName = new Map(evalCases.map((evalCase) => [evalCase.name, evalCase]));

  return {
    evalCases,
    issues: output.issues.map((issue, index) => ({
      id: makeStableId("issue", project.id, issue.title, index),
      evalCaseId: caseByName.get(issue.evalCaseName)?.id || evalCases[0]?.id || makeStableId("case", project.id, "unknown"),
      title: issue.title,
      severity: issue.severity,
      status: "open",
      description: issue.description,
    })),
    graders: output.graders.map((grader, index) => ({
      id: makeStableId("grader", project.id, grader.name, index),
      name: grader.name,
      type: grader.type,
      description: grader.description,
      health: grader.health,
      agreement: grader.agreement,
      model: grader.model,
    })),
    promptCandidates: output.promptCandidates.map((candidate) => ({
      title: candidate.title,
      promptBody: candidate.promptBody || candidate.explanation,
      sourcePromptVersionId: candidate.sourcePromptVersionId,
      diffSummary: candidate.diffSummary,
      expectedQualityLift: candidate.expectedQualityLift,
      expectedCostDelta: candidate.expectedCostDelta,
      expectedLatencyDeltaMs: candidate.expectedLatencyDeltaMs,
      baselinePassRate: candidate.baselinePassRate,
      candidatePassRate: candidate.candidatePassRate,
      regressionRisk: candidate.regressionRisk,
      explanation: candidate.explanation,
      confidence: candidate.confidence,
      evidenceRefs: candidate.evidenceRefs || [],
    })),
    routingRules: output.routingRules.map((rule) => ({
      intent: rule.intent,
      model: rule.model,
      fallback: rule.fallback,
      qualityScore: rule.qualityScore,
      estimatedCost: rule.estimatedCost,
      estimatedLatencyMs: rule.estimatedLatencyMs,
      trafficShare: rule.trafficShare,
      confidence: rule.confidence,
      evidenceRefs: rule.evidenceRefs || [],
      calculationBasis: rule.calculationBasis,
    })),
    cacheRecommendations: output.cacheRecommendations.map((recommendation) => ({
      title: recommendation.title,
      detail: recommendation.detail,
      impact: recommendation.impact,
      estimatedMonthlySavings: recommendation.estimatedMonthlySavings,
      confidence: recommendation.confidence,
      evidenceRefs: recommendation.evidenceRefs || [],
      calculationBasis: recommendation.calculationBasis,
    })),
    failureClusters: output.failureClusters,
    report: {
      summary: output.report.summary,
      readinessScore: Math.round(output.report.readinessScore),
      recommendations: output.report.recommendations,
    },
  };
}

function makeStableId(prefix: string, ...parts: Array<string | number>) {
  const value = parts.join(":");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `${prefix}_${hash.toString(16).padStart(8, "0")}`;
}
