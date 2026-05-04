import { z } from "zod";
import type { EvallerWorkspace } from "./types";

export const evallerScenarioInputSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().max(120).default(""),
  message: z.string().trim().max(3000).default(""),
  expectedBehavior: z.string().trim().max(2000).optional().default(""),
});

export const evallerSuccessCriterionInputSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  text: z.string().trim().max(280).default(""),
});

export const evallerWorkspaceInputSchema = z.object({
  name: z.string().trim().max(120).default(""),
  description: z.string().trim().max(1000).default(""),
  instructions: z.string().trim().max(8000).default(""),
  qualityBar: z.coerce.number().int().min(50).max(100).default(80),
  scenarios: z.array(evallerScenarioInputSchema).max(25).default([]),
  successCriteria: z.array(evallerSuccessCriterionInputSchema).max(12).default([]),
});

export const applyFixRequestSchema = z.object({
  suggestionId: z.string().trim().min(1).max(120),
});

export function validateRunnableWorkspace(workspace: EvallerWorkspace) {
  const issues: string[] = [];

  if (!workspace.aiTest.name.trim()) {
    issues.push("Name the AI feature you are testing.");
  }

  if (!workspace.activePrompt.instructions.trim()) {
    issues.push("Add the AI instructions before running a test.");
  }

  const runnableScenarios = workspace.scenarios.filter((scenario) => scenario.message.trim());
  if (!runnableScenarios.length) {
    issues.push("Add at least one user scenario.");
  }

  if (workspace.scenarios.some((scenario) => !scenario.message.trim())) {
    issues.push("Remove or complete empty user scenarios.");
  }

  const criteria = workspace.successCriteria.filter((criterion) => criterion.text.trim());
  if (!criteria.length) {
    issues.push("Add at least one success criterion.");
  }

  if (workspace.successCriteria.some((criterion) => !criterion.text.trim())) {
    issues.push("Remove or complete empty success criteria.");
  }

  if (!Number.isInteger(workspace.aiTest.qualityBar) || workspace.aiTest.qualityBar < 50 || workspace.aiTest.qualityBar > 100) {
    issues.push("Set the quality bar between 50 and 100.");
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export type EvallerWorkspaceInputSchema = z.infer<typeof evallerWorkspaceInputSchema>;
