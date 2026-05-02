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

export const updateEvalCaseRequestSchema = z.object({
  userInput: z.string().min(1).max(5000).optional(),
  expectedBehavior: z.string().min(1).max(5000).optional(),
  acceptanceCriteria: z.array(z.string().min(1).max(500)).optional(),
  status: z.enum(["passed", "failed", "review"]).optional(),
});

export const promotePromptRequestSchema = z.object({
  candidateId: z.string().min(1),
});
