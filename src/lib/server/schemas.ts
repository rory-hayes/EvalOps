import { z } from "zod";

export const createProjectRequestSchema = z.object({
  name: z.string().min(2).max(120),
  workflowType: z.enum(["support_assistant", "rag", "tool_agent", "document_extraction", "custom"]),
  objective: z.string().min(10).max(2000),
  riskPreferences: z.array(z.string().min(1)).default([]),
  privacyMode: z.enum(["redact_pii", "derived_only", "short_retention"]).default("redact_pii"),
});

export const updateIssueRequestSchema = z.object({
  status: z.enum(["open", "resolved", "ignored", "reopened"]),
  comment: z.string().max(2000).optional(),
});

export const updateProjectSettingsRequestSchema = z.object({
  privacyMode: z.enum(["redact_pii", "derived_only", "short_retention"]).optional(),
  riskPreferences: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
}).refine((input) => input.privacyMode !== undefined || input.riskPreferences !== undefined, {
  message: "At least one project setting must be provided.",
});

export const updateEvalCaseRequestSchema = z.object({
  userInput: z.string().min(1).max(5000).optional(),
  expectedBehavior: z.string().min(1).max(5000).optional(),
  acceptanceCriteria: z.array(z.string().min(1).max(500)).optional(),
  status: z.enum(["passed", "failed", "review"]).optional(),
});

export const updateGraderRequestSchema = z.object({
  description: z.string().trim().min(10).max(2000).optional(),
  active: z.boolean().optional(),
  model: z.union([z.string().trim().min(1).max(80), z.literal(""), z.null()]).optional()
    .transform((value) => (value === "" ? null : value)),
}).refine((input) => input.description !== undefined || input.active !== undefined || input.model !== undefined, {
  message: "At least one grader setting must be provided.",
});

export const promotePromptRequestSchema = z.object({
  candidateId: z.string().min(1),
});

export const createExportRequestSchema = z.object({
  type: z.enum(["eval_pack_csv", "issues_csv", "audit_report_csv", "audit_report_pdf"]).default("eval_pack_csv"),
});
