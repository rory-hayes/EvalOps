import { z } from "zod";

export const riskLevelSchema = z.enum(["low", "medium", "high"]);
export const statusSchema = z.enum(["passed", "failed", "degraded", "processing"]);
export const workflowTypeSchema = z.enum([
  "support_assistant",
  "rag",
  "tool_agent",
  "document_extraction",
  "custom",
]);

export const intentSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  riskLevel: riskLevelSchema,
  coveragePercent: z.number().min(0).max(100),
});

export const evalDatasetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  set: z.enum(["golden", "regression", "edge", "safety"]),
  caseCount: z.number().int().nonnegative(),
  coverageIntentIds: z.array(z.string().min(1)),
  lastGeneratedAt: z.string().datetime().optional(),
});

export const evidenceRefSchema = z.object({
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

export const evalResultSchema = z.object({
  id: z.string().min(1),
  evalRunId: z.string().min(1),
  evalCaseId: z.string().min(1),
  status: z.enum(["passed", "failed", "review"]),
  score: z.number().min(0).max(100),
  graderId: z.string().min(1),
  rationale: z.string().min(1),
  evidenceRefs: z.array(evidenceRefSchema).default([]),
  promptVersionId: z.string().min(1).optional(),
  promptCandidateId: z.string().min(1).optional(),
  model: z.string().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  estimatedCost: z.number().nonnegative().optional(),
  tokenUsage: z.record(z.string(), z.unknown()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  createdAt: z.string().datetime().optional(),
});

export const traceImportSchema = z.object({
  id: z.string().min(1),
  source: z.enum(["CSV", "JSON", "NDJSON", "TXT"]),
  name: z.string().min(1),
  importedAt: z.string().datetime(),
  traces: z.number().int().nonnegative(),
  rows: z.number().int().nonnegative(),
  status: z.enum(["processing", "completed", "failed"]),
  redactionStatus: z.enum(["in_progress", "redacted", "pending", "failed"]),
  primaryIntent: z.string().min(1),
  riskLevel: riskLevelSchema,
  rawRetentionExpiresAt: z.string().datetime().nullable().optional(),
  rawPurgedAt: z.string().datetime().nullable().optional(),
});

export const evalCaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  set: z.enum(["golden", "regression", "edge", "safety"]),
  intent: z.string().min(1),
  source: z.enum(["production", "synthetic", "requirements", "known_failure"]),
  risk: riskLevelSchema,
  grader: z.string().min(1),
  lastResult: z.number().min(0).max(100),
  status: z.enum(["passed", "failed", "review"]),
  userInput: z.string().min(1),
  expectedBehavior: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
});

export const graderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["deterministic", "llm_judge"]),
  description: z.string().min(1),
  health: z.enum(["healthy", "low_agreement", "review"]),
  agreement: z.number().min(0).max(1),
  model: z.string().optional(),
  passThreshold: z.number().min(0).max(1).default(0.8),
  reviewThreshold: z.number().min(0).max(1).default(0.6),
  rubric: z.string().min(1).optional(),
  failureModes: z.array(z.string().min(1)).default([]),
  lastCalibratedAt: z.string().datetime().optional(),
});

export const humanLabelSchema = z.object({
  id: z.string().min(1),
  evalCaseId: z.string().min(1),
  graderId: z.string().min(1),
  score: z.number().min(0).max(100),
  status: z.enum(["passed", "failed", "review"]),
  notes: z.string().max(2000).optional(),
  labeledBy: z.string().min(1),
  labeledAt: z.string().datetime(),
});

export const graderCalibrationResultSchema = z.object({
  id: z.string().min(1),
  calibrationRunId: z.string().min(1),
  evalCaseId: z.string().min(1),
  graderId: z.string().min(1),
  humanLabelId: z.string().min(1),
  evalResultId: z.string().min(1).optional(),
  humanScore: z.number().min(0).max(100),
  judgeScore: z.number().min(0).max(100).optional(),
  scoreDelta: z.number().min(0).max(100),
  disagreementSeverity: z.enum(["none", "low", "medium", "high"]),
  reviewStatus: z.enum(["open", "accepted", "dismissed"]),
  createdAt: z.string().datetime(),
});

export const auditReadinessInputSchema = z.object({
  intentCoverage: z.number().min(0).max(100),
  judgeCalibration: z.number().min(0).max(100),
  regressionPassRate: z.number().min(0).max(100),
  staleEvalRisk: z.enum(["low", "medium", "high"]),
});

export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type WorkflowType = z.infer<typeof workflowTypeSchema>;
export type Intent = z.infer<typeof intentSchema>;
export type EvalDataset = z.infer<typeof evalDatasetSchema>;
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;
export type EvalResult = z.infer<typeof evalResultSchema>;
export type TraceImport = z.infer<typeof traceImportSchema>;
export type EvalCase = z.infer<typeof evalCaseSchema>;
export type Grader = z.infer<typeof graderSchema>;
export type HumanLabel = z.infer<typeof humanLabelSchema>;
export type GraderCalibrationResult = z.infer<typeof graderCalibrationResultSchema>;
export type AuditReadinessInput = z.infer<typeof auditReadinessInputSchema>;

export function computeAuditReadiness(input: AuditReadinessInput) {
  const parsed = auditReadinessInputSchema.parse(input);
  const stalePenalty = {
    low: 0,
    medium: 1,
    high: 6,
  }[parsed.staleEvalRisk];

  const score = Math.round(
    (parsed.intentCoverage + parsed.judgeCalibration + parsed.regressionPassRate) /
      3 -
      stalePenalty,
  );

  if (score >= 95) {
    return {
      score,
      label: "Excellent",
      recommendation: "Keep monitoring drift and expand edge-case coverage.",
    };
  }

  if (score >= 85) {
    return {
      score,
      label: "Operational",
      recommendation: "Expand coverage for weak intents and keep calibration fresh.",
    };
  }

  if (score >= 70) {
    return {
      score,
      label: "At risk",
      recommendation: "Prioritize regression cases and judge recalibration before shipping.",
    };
  }

  return {
    score,
    label: "Needs audit",
    recommendation: "Run an Eval Debt Audit before expanding production traffic.",
  };
}
