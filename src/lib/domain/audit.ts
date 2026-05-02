import { z } from "zod";

export const riskLevelSchema = z.enum(["low", "medium", "high"]);
export const statusSchema = z.enum(["passed", "failed", "degraded", "processing"]);

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
});

export const auditReadinessInputSchema = z.object({
  intentCoverage: z.number().min(0).max(100),
  judgeCalibration: z.number().min(0).max(100),
  regressionPassRate: z.number().min(0).max(100),
  staleEvalRisk: z.enum(["low", "medium", "high"]),
});

export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type TraceImport = z.infer<typeof traceImportSchema>;
export type EvalCase = z.infer<typeof evalCaseSchema>;
export type Grader = z.infer<typeof graderSchema>;
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
