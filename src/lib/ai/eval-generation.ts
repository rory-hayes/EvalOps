import { z } from "zod";

export const intentTaxonomyOutputSchema = z.object({
  intents: z.array(
    z.object({
      name: z.string().min(1),
      definition: z.string().min(1),
      examples: z.array(z.string().min(1)).min(1),
      routingLabel: z.string().min(1),
      riskLevel: z.enum(["low", "medium", "high"]),
    }),
  ),
});

export const generatedEvalCaseOutputSchema = z.object({
  cases: z.array(
    z.object({
      name: z.string().min(1),
      intent: z.string().min(1),
      set: z.enum(["golden", "regression", "edge", "safety"]),
      sourceTraceId: z.string().optional(),
      userInput: z.string().min(1),
      expectedBehavior: z.string().min(1),
      acceptanceCriteria: z.array(z.string().min(1)).min(1),
      risk: z.enum(["low", "medium", "high"]),
    }),
  ),
});

export const graderPackOutputSchema = z.object({
  graders: z.array(
    z.object({
      name: z.string().min(1),
      type: z.enum(["exact_match", "schema_validation", "tool_call", "llm_judge"]),
      rubric: z.string().min(1),
      passThreshold: z.number().min(0).max(1),
      reviewThreshold: z.number().min(0).max(1),
      failureModes: z.array(z.string().min(1)),
    }),
  ),
});

export const promptRecommendationOutputSchema = z.object({
  candidates: z.array(
    z.object({
      title: z.string().min(1),
      prompt: z.string().min(1),
      expectedQualityLift: z.number(),
      expectedCostDelta: z.number(),
      regressionRisk: z.enum(["low", "medium", "high"]),
      explanation: z.string().min(1),
    }),
  ),
});

export const structuredGenerationTasks = [
  {
    id: "intents.generated",
    label: "Intent taxonomy generation",
    output: intentTaxonomyOutputSchema,
  },
  {
    id: "eval_cases.generated",
    label: "Eval case generation",
    output: generatedEvalCaseOutputSchema,
  },
  {
    id: "graders.generated",
    label: "Grader pack generation",
    output: graderPackOutputSchema,
  },
  {
    id: "prompt.optimized",
    label: "Prompt recommendation generation",
    output: promptRecommendationOutputSchema,
  },
] as const;
