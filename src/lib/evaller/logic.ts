import type {
  EvallerAiRunOutput,
  EvallerAiTest,
  EvallerFailurePattern,
  EvallerPromptSuggestion,
  EvallerPromptVersion,
  EvallerRunDetail,
  EvallerRunSummary,
  EvallerScenario,
  EvallerScenarioResult,
  EvallerSuccessCriterion,
} from "./types";

export const DEFAULT_EVALLER_PROMPT = [
  "You are a support AI for a B2B SaaS product.",
  "Give concise, accurate answers.",
  "Be friendly and avoid making promises you cannot keep.",
].join("\n");

export const DEFAULT_SCENARIOS = [
  {
    title: "Frustrated billing issue",
    message: "I have been charged twice and nobody has fixed it. This is really frustrating.",
    expectedBehavior: "Acknowledge frustration, explain the billing path, and offer a human handoff.",
  },
  {
    title: "Privacy deletion request",
    message: "Delete all of my account data and confirm it is gone today.",
    expectedBehavior: "Treat the request carefully, avoid overpromising, and explain the safe next step.",
  },
  {
    title: "Stuck account setup",
    message: "I cannot finish setup and I need this working before a customer demo tomorrow.",
    expectedBehavior: "Ask one clarifying question, provide a practical next step, and offer escalation.",
  },
];

export const DEFAULT_SUCCESS_CRITERIA = [
  "Acknowledges user frustration or urgency",
  "Gives a safe and accurate support answer",
  "Offers a human handoff for billing, privacy, or urgent issues",
  "Does not promise unsupported account, billing, or deletion actions",
];

export function buildDefaultAiTest(input: {
  id: string;
  organizationId: string;
  ownerUserId: string;
  promptVersionId: string;
  now: string;
}): EvallerAiTest {
  return {
    id: input.id,
    organizationId: input.organizationId,
    ownerUserId: input.ownerUserId,
    name: "Support AI quality test",
    description: "Check whether a support AI handles realistic customer scenarios before shipping.",
    qualityBar: 80,
    activePromptVersionId: input.promptVersionId,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function buildRunSummary(input: {
  runId: string;
  aiTestId: string;
  organizationId: string;
  promptVersion: EvallerPromptVersion;
  qualityBar: number;
  results: EvallerScenarioResult[];
  previousRunId?: string;
  now: string;
}): EvallerRunSummary {
  const totalScenarios = input.results.length;
  const failedScenarios = input.results.filter((result) => result.status === "failed").length;
  const scoreTotal = input.results.reduce((total, result) => total + result.score, 0);
  const averageScore = totalScenarios ? round(scoreTotal / totalScenarios) : 0;
  const passRate = totalScenarios ? round(((totalScenarios - failedScenarios) / totalScenarios) * 100) : 0;

  return {
    id: input.runId,
    aiTestId: input.aiTestId,
    organizationId: input.organizationId,
    promptVersionId: input.promptVersion.id,
    promptVersionLabel: input.promptVersion.label,
    status: "completed",
    qualityBar: input.qualityBar,
    passRate,
    averageScore,
    totalScenarios,
    failedScenarios,
    previousRunId: input.previousRunId,
    startedAt: input.now,
    completedAt: input.now,
  };
}

export function mapAiOutputToStoredArtifacts(input: {
  output: EvallerAiRunOutput;
  runId: string;
  aiTestId: string;
  organizationId: string;
  scenarios: EvallerScenario[];
  criteria: EvallerSuccessCriterion[];
  qualityBar: number;
  now: string;
  makeId: (prefix: string) => string;
}) {
  const criteriaText = input.criteria.map((criterion) => criterion.text);

  const results: EvallerScenarioResult[] = input.scenarios.map((scenario) => {
    const result = input.output.results.find((item) => item.scenarioId === scenario.id);
    const failedCriteria = normalizeCriteria(result?.failedCriteria || criteriaText, criteriaText);
    const passedCriteria = normalizeCriteria(result?.passedCriteria || [], criteriaText).filter(
      (criterion) => !failedCriteria.includes(criterion),
    );
    const score = clampScore(result?.score ?? scoreFromCriteria(passedCriteria.length, criteriaText.length));

    return {
      id: input.makeId("scenario_result"),
      runId: input.runId,
      scenarioId: scenario.id,
      organizationId: input.organizationId,
      aiTestId: input.aiTestId,
      scenarioTitle: scenario.title,
      scenarioMessage: scenario.message,
      assistantResponse: result?.assistantResponse?.trim() || "No assistant response was returned.",
      score,
      status: score >= input.qualityBar ? "passed" : "failed",
      passedCriteria,
      failedCriteria,
      rationale: result?.rationale?.trim() || "The response did not meet the configured quality bar.",
      createdAt: input.now,
    };
  });

  const failurePatterns: EvallerFailurePattern[] = input.output.failurePatterns
    .filter((pattern) => pattern.title.trim())
    .map((pattern) => ({
      id: input.makeId("failure_pattern"),
      runId: input.runId,
      organizationId: input.organizationId,
      aiTestId: input.aiTestId,
      title: pattern.title.trim(),
      description: pattern.description.trim() || "Repeated failure pattern found across the run.",
      failedCriteria: normalizeCriteria(pattern.failedCriteria, criteriaText),
      scenarioIds: pattern.scenarioIds.filter((id) => input.scenarios.some((scenario) => scenario.id === id)),
      severity: pattern.severity,
      createdAt: input.now,
    }));

  const promptSuggestions: EvallerPromptSuggestion[] = input.output.promptSuggestions
    .filter((suggestion) => suggestion.title.trim() && suggestion.revisedInstructions.trim())
    .map((suggestion) => ({
      id: input.makeId("prompt_suggestion"),
      runId: input.runId,
      organizationId: input.organizationId,
      aiTestId: input.aiTestId,
      title: suggestion.title.trim(),
      explanation: suggestion.explanation.trim(),
      patch: suggestion.patch.trim(),
      revisedInstructions: suggestion.revisedInstructions.trim(),
      affectedCriteria: normalizeCriteria(suggestion.affectedCriteria, criteriaText),
      createdAt: input.now,
    }));

  return {
    results,
    failurePatterns,
    promptSuggestions,
  };
}

export function buildRunDetail(
  run: EvallerRunSummary,
  results: EvallerScenarioResult[],
  failurePatterns: EvallerFailurePattern[],
  promptSuggestions: EvallerPromptSuggestion[],
  previousRun?: EvallerRunSummary,
): EvallerRunDetail {
  return {
    ...run,
    results,
    failurePatterns,
    promptSuggestions,
    previousRun,
  };
}

export function buildFallbackFailurePatterns(input: {
  runId: string;
  aiTestId: string;
  organizationId: string;
  results: EvallerScenarioResult[];
  now: string;
  makeId: (prefix: string) => string;
}) {
  const byCriterion = new Map<string, EvallerScenarioResult[]>();
  for (const result of input.results) {
    for (const criterion of result.failedCriteria) {
      byCriterion.set(criterion, [...(byCriterion.get(criterion) || []), result]);
    }
  }

  return Array.from(byCriterion.entries()).map(([criterion, results]) => ({
    id: input.makeId("failure_pattern"),
    runId: input.runId,
    organizationId: input.organizationId,
    aiTestId: input.aiTestId,
    title: `Missed: ${criterion}`,
    description: `${results.length} user scenario${results.length === 1 ? "" : "s"} missed this success criterion.`,
    failedCriteria: [criterion],
    scenarioIds: results.map((result) => result.scenarioId).filter(Boolean) as string[],
    severity: results.length >= 2 ? "high" : "medium",
    createdAt: input.now,
  })) satisfies EvallerFailurePattern[];
}

export function buildFallbackPromptSuggestion(input: {
  instructions: string;
  runId: string;
  aiTestId: string;
  organizationId: string;
  results: EvallerScenarioResult[];
  now: string;
  makeId: (prefix: string) => string;
}) {
  const failedCriteria = Array.from(new Set(input.results.flatMap((result) => result.failedCriteria)));
  if (!failedCriteria.length) return [];

  const patch = [
    "Add explicit support quality rules:",
    "- Acknowledge user frustration or urgency before solving.",
    "- Offer a human handoff for billing, privacy, deletion, escalation, or urgent demo-blocking issues.",
    "- State policy boundaries clearly and avoid promising unsupported actions.",
    "- Ask one clarifying question when the safest next step depends on missing account details.",
  ].join("\n");

  return [
    {
      id: input.makeId("prompt_suggestion"),
      runId: input.runId,
      organizationId: input.organizationId,
      aiTestId: input.aiTestId,
      title: "Add support handoff and safety rules",
      explanation: "The failed scenarios need clearer instructions for urgency, escalation, and policy boundaries.",
      patch,
      revisedInstructions: `${input.instructions.trim()}\n\nEvaller improvement:\n${patch}`.trim(),
      affectedCriteria: failedCriteria,
      createdAt: input.now,
    },
  ] satisfies EvallerPromptSuggestion[];
}

function normalizeCriteria(criteria: string[], allowedCriteria: string[]) {
  const allowed = new Set(allowedCriteria);
  return Array.from(new Set(criteria.map((criterion) => criterion.trim()).filter((criterion) => allowed.has(criterion))));
}

function scoreFromCriteria(passed: number, total: number) {
  if (!total) return 0;
  return Math.round((passed / total) * 100);
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
