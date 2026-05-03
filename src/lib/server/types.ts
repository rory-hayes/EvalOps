import type {
  EvalCase,
  EvalDataset,
  EvalResult,
  Grader,
  Intent,
  RiskLevel,
  TraceImport,
  WorkflowType,
} from "../domain/audit";
import type { IssueStatus, NormalizedTrace, ReviewIssue } from "../domain/trace-processing";

export type ActorContext = {
  userId: string;
  email?: string;
  organizationId?: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
};

export type OrganizationMembership = {
  id: string;
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "member" | "reviewer";
  createdAt: string;
};

export type Project = {
  id: string;
  organizationId: string;
  name: string;
  workflowType: WorkflowType;
  objective: string;
  riskPreferences: string[];
  privacyMode: "redact_pii" | "derived_only" | "short_retention";
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type StoredTrace = NormalizedTrace & {
  id: string;
  organizationId: string;
  projectId: string;
  traceImportId: string;
};

export type UploadedFile = {
  id: string;
  organizationId: string;
  projectId: string;
  traceImportId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
  checksum: string;
  createdAt: string;
};

export type ProcessingJob = {
  id: string;
  organizationId: string;
  projectId: string;
  traceImportId: string;
  action:
    | "trace_import"
    | "pii_redaction"
    | "intent_generation"
    | "eval_generation"
    | "grader_generation"
    | "baseline_run"
    | "prompt_optimization"
    | "routing_analysis"
    | "report_generation";
  status: "queued" | "running" | "completed" | "failed";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
};

export type StoredEvalCase = EvalCase & {
  organizationId: string;
  projectId: string;
  traceId?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredGrader = Grader & {
  organizationId: string;
  projectId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoredIssue = ReviewIssue & {
  organizationId: string;
  projectId: string;
  traceId?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type IssueComment = {
  id: string;
  organizationId: string;
  projectId: string;
  issueId: string;
  actorUserId: string;
  body: string;
  createdAt: string;
};

export type EvalRun = {
  id: string;
  organizationId: string;
  projectId: string;
  status: "queued" | "running" | "completed" | "failed";
  passRate: number;
  totalCases: number;
  failedCases: number;
  startedAt: string;
  completedAt?: string;
};

export type FailureCluster = {
  id: string;
  organizationId: string;
  projectId: string;
  label: string;
  severity: RiskLevel;
  issueCount: number;
  percent: number;
  createdAt: string;
};

export type StoredIntent = Intent & {
  organizationId: string;
  projectId: string;
  createdAt: string;
};

export type StoredEvalDataset = EvalDataset & {
  organizationId: string;
  projectId: string;
  createdAt: string;
};

export type StoredEvalResult = EvalResult & {
  organizationId: string;
  projectId: string;
  createdAt: string;
};

export type PromptVersion = {
  id: string;
  organizationId: string;
  projectId: string;
  label: string;
  prompt: string;
  status: "current" | "candidate" | "promoted";
  createdAt: string;
};

export type PromptCandidate = {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  expectedQualityLift: number;
  expectedCostDelta: number;
  regressionRisk: RiskLevel;
  explanation: string;
  createdAt: string;
};

export type RoutingRule = {
  id: string;
  organizationId: string;
  projectId: string;
  intent: string;
  model: string;
  fallback: string;
  qualityScore: number;
  estimatedCost: number;
  estimatedLatencyMs: number;
  trafficShare: number;
  createdAt: string;
};

export type CacheRecommendation = {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  detail: string;
  impact: "low" | "medium" | "high";
  estimatedMonthlySavings: number;
  createdAt: string;
};

export type Report = {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  summary: string;
  readinessScore: number;
  recommendations: string[];
  createdAt: string;
};

export type ExportRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  type: "eval_pack_csv" | "issues_csv" | "audit_report_csv" | "audit_report_pdf";
  status: "generated" | "failed";
  storageBucket: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

export type AuditEvent = {
  id: string;
  organizationId: string;
  actorUserId: string;
  entityType: string;
  entityId: string;
  action: string;
  status: "started" | "succeeded" | "failed";
  metadata: Record<string, unknown>;
  correlationId?: string;
  createdAt: string;
};

export type WorkspaceState = {
  organization: Organization;
  user: UserProfile;
  membership: OrganizationMembership;
  projects: Project[];
  activeProject?: Project;
  traceImports: TraceImport[];
  traces: StoredTrace[];
  uploadedFiles: UploadedFile[];
  processingJobs: ProcessingJob[];
  evalCases: StoredEvalCase[];
  graders: StoredGrader[];
  issues: StoredIssue[];
  issueComments: IssueComment[];
  evalRuns: EvalRun[];
  failureClusters: FailureCluster[];
  promptVersions: PromptVersion[];
  promptCandidates: PromptCandidate[];
  routingRules: RoutingRule[];
  cacheRecommendations: CacheRecommendation[];
  reports: Report[];
  exports: ExportRecord[];
  auditEvents: AuditEvent[];
};

export type CreateProjectInput = {
  name: string;
  workflowType: Project["workflowType"];
  objective: string;
  riskPreferences: string[];
  privacyMode: Project["privacyMode"];
};

export type UpdateProjectSettingsInput = {
  privacyMode?: Project["privacyMode"];
  riskPreferences?: string[];
};

export type CreateTraceImportInput = {
  projectId: string;
  fileName: string;
  contentType: string;
  text: string;
};

export type ProcessTraceImportInput = {
  projectId: string;
  traceImportId: string;
  jobId?: string;
};

export type CreateExportInput = {
  type?: ExportRecord["type"];
};

export type UpdateIssueInput = {
  issueId: string;
  status: IssueStatus;
  comment?: string;
};

export type UpdateGraderInput = {
  graderId: string;
  description?: string;
  active?: boolean;
  model?: string | null;
};

export type EvalOpsStore = {
  ensureWorkspace(actor: ActorContext): Promise<WorkspaceState>;
  getWorkspaceState(actor: ActorContext, projectId?: string): Promise<WorkspaceState>;
  getProjectState(actor: ActorContext, projectId: string): Promise<WorkspaceState>;
  createProject(actor: ActorContext, input: CreateProjectInput): Promise<Project>;
  updateProjectSettings(actor: ActorContext, projectId: string, input: UpdateProjectSettingsInput): Promise<Project>;
  createTraceImport(actor: ActorContext, input: CreateTraceImportInput): Promise<{
    importRecord: TraceImport;
    job: ProcessingJob;
  }>;
  processTraceImport(actor: ActorContext, input: ProcessTraceImportInput): Promise<{
    importRecord: TraceImport;
    job: ProcessingJob;
  }>;
  updateIssue(actor: ActorContext, input: UpdateIssueInput): Promise<StoredIssue>;
  updateGrader(actor: ActorContext, input: UpdateGraderInput): Promise<StoredGrader>;
  updateEvalCase(actor: ActorContext, input: {
    caseId: string;
    userInput?: string;
    expectedBehavior?: string;
    acceptanceCriteria?: string[];
    status?: EvalCase["status"];
  }): Promise<StoredEvalCase>;
  createExport(actor: ActorContext, projectId: string, input?: CreateExportInput): Promise<ExportRecord>;
  getExport(actor: ActorContext, exportId: string): Promise<{ record: ExportRecord; content: string | Uint8Array }>;
  rerunEvaluation(actor: ActorContext, projectId: string): Promise<EvalRun>;
  promotePromptCandidate(actor: ActorContext, projectId: string, candidateId: string): Promise<PromptVersion>;
};
