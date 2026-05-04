export type EvallerScenarioResultStatus = "passed" | "failed";
export type EvallerRunStatus = "running" | "completed" | "failed";

export type EvallerAiTest = {
  id: string;
  organizationId: string;
  ownerUserId: string;
  name: string;
  description: string;
  qualityBar: number;
  activePromptVersionId: string;
  createdAt: string;
  updatedAt: string;
};

export type EvallerPromptVersion = {
  id: string;
  aiTestId: string;
  organizationId: string;
  version: number;
  label: string;
  instructions: string;
  isActive: boolean;
  sourceSuggestionId?: string;
  createdAt: string;
};

export type EvallerScenario = {
  id: string;
  aiTestId: string;
  organizationId: string;
  title: string;
  message: string;
  expectedBehavior: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EvallerSuccessCriterion = {
  id: string;
  aiTestId: string;
  organizationId: string;
  text: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EvallerRunSummary = {
  id: string;
  aiTestId: string;
  organizationId: string;
  promptVersionId: string;
  promptVersionLabel: string;
  status: EvallerRunStatus;
  qualityBar: number;
  passRate: number;
  averageScore: number;
  totalScenarios: number;
  failedScenarios: number;
  previousRunId?: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
};

export type EvallerScenarioResult = {
  id: string;
  runId: string;
  scenarioId?: string;
  organizationId: string;
  aiTestId: string;
  scenarioTitle: string;
  scenarioMessage: string;
  assistantResponse: string;
  score: number;
  status: EvallerScenarioResultStatus;
  passedCriteria: string[];
  failedCriteria: string[];
  rationale: string;
  createdAt: string;
};

export type EvallerFailurePattern = {
  id: string;
  runId: string;
  organizationId: string;
  aiTestId: string;
  title: string;
  description: string;
  failedCriteria: string[];
  scenarioIds: string[];
  severity: "low" | "medium" | "high";
  createdAt: string;
};

export type EvallerPromptSuggestion = {
  id: string;
  runId: string;
  organizationId: string;
  aiTestId: string;
  title: string;
  explanation: string;
  patch: string;
  revisedInstructions: string;
  affectedCriteria: string[];
  appliedAt?: string;
  appliedPromptVersionId?: string;
  createdAt: string;
};

export type EvallerRunDetail = EvallerRunSummary & {
  results: EvallerScenarioResult[];
  failurePatterns: EvallerFailurePattern[];
  promptSuggestions: EvallerPromptSuggestion[];
  previousRun?: EvallerRunSummary;
};

export type EvallerWorkspace = {
  user: {
    id: string;
    email?: string;
  };
  aiTest: EvallerAiTest;
  activePrompt: EvallerPromptVersion;
  promptVersions: EvallerPromptVersion[];
  scenarios: EvallerScenario[];
  successCriteria: EvallerSuccessCriterion[];
  runs: EvallerRunSummary[];
  latestRun?: EvallerRunDetail;
};

export type EvallerWorkspaceInput = {
  name: string;
  description: string;
  instructions: string;
  qualityBar: number;
  scenarios: Array<{
    id?: string;
    title: string;
    message: string;
    expectedBehavior?: string;
  }>;
  successCriteria: Array<{
    id?: string;
    text: string;
  }>;
};

export type EvallerAiRunOutput = {
  results: Array<{
    scenarioId: string;
    assistantResponse: string;
    score: number;
    passedCriteria: string[];
    failedCriteria: string[];
    rationale: string;
  }>;
  failurePatterns: Array<{
    title: string;
    description: string;
    failedCriteria: string[];
    scenarioIds: string[];
    severity: "low" | "medium" | "high";
  }>;
  promptSuggestions: Array<{
    title: string;
    explanation: string;
    patch: string;
    revisedInstructions: string;
    affectedCriteria: string[];
  }>;
};

export type EvallerStore = {
  getWorkspace(actor: EvallerActor): Promise<EvallerWorkspace>;
  saveWorkspace(actor: EvallerActor, input: EvallerWorkspaceInput): Promise<EvallerWorkspace>;
  runTest(actor: EvallerActor, input: EvallerWorkspaceInput): Promise<EvallerRunDetail>;
  listRuns(actor: EvallerActor): Promise<EvallerRunSummary[]>;
  getRun(actor: EvallerActor, runId: string): Promise<EvallerRunDetail>;
  applyFix(actor: EvallerActor, runId: string, suggestionId: string): Promise<EvallerWorkspace>;
};

export type EvallerActor = {
  userId: string;
  email?: string;
  organizationId?: string;
};
