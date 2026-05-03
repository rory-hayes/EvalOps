import type {
  EvalCase,
  EvalDataset,
  EvalResult,
  EvidenceRef,
  Grader,
  GraderCalibrationResult,
  HumanLabel,
  Intent,
  RiskLevel,
  TraceImport,
  WorkflowType,
} from "../domain/audit";
import type { IssueStatus, NormalizedTrace, ReviewIssue } from "../domain/trace-processing";
import type { BillingPlanId, BillingStatus, UsageMetric } from "./commercial/plans";
import type { MonthlyPeriod, UsageSummary } from "./commercial/usage";

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

export type OrganizationBilling = {
  organizationId: string;
  planId: BillingPlanId;
  status: BillingStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  stripeCurrentPeriodStart?: string;
  stripeCurrentPeriodEnd?: string;
  trialEndsAt?: string;
  cancelAtPeriodEnd: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type StoredUsageEvent = {
  id: string;
  organizationId: string;
  projectId?: string;
  metric: UsageMetric;
  quantity: number;
  source: string;
  sourceId?: string;
  periodStart: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type OrganizationInvitation = {
  id: string;
  organizationId: string;
  email: string;
  role: Exclude<OrganizationMembership["role"], "owner">;
  status: "pending" | "accepted" | "revoked" | "expired";
  invitedBy: string;
  acceptedBy?: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type SupportRequest = {
  id: string;
  organizationId: string;
  projectId?: string;
  actorUserId: string;
  requestType: "support" | "incident" | "billing" | "data_request";
  priority: "low" | "normal" | "high" | "urgent";
  subject: string;
  message: string;
  status: "open" | "triaged" | "closed";
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BillingOverview = {
  billing: OrganizationBilling;
  usage: UsageSummary;
  period: MonthlyPeriod;
  canUseFeatures: boolean;
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

export type StoredTrace = Omit<NormalizedTrace, "input" | "output" | "metadata"> & {
  id: string;
  organizationId: string;
  projectId: string;
  traceImportId?: string;
  input: string | null;
  output: string | null;
  metadata: Record<string, unknown> | null;
  rawRetentionExpiresAt?: string;
  rawPurgedAt?: string;
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
  rawRetentionExpiresAt?: string;
  rawPurgedAt?: string;
  storageDeletedAt?: string;
  createdAt: string;
};

export type ProcessingJob = {
  id: string;
  organizationId: string;
  projectId: string;
  traceImportId?: string;
  action:
    | "trace_import"
    | "pii_redaction"
    | "intent_generation"
    | "eval_generation"
    | "grader_generation"
    | "baseline_run"
    | "prompt_optimization"
    | "routing_analysis"
    | "report_generation"
    | "project_export"
    | "project_delete"
    | "raw_trace_purge";
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
  passThreshold: number;
  reviewThreshold: number;
  rubric: string;
  failureModes: string[];
  lastCalibratedAt?: string;
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
  runType?: "baseline" | "manual" | "candidate_comparison" | "calibration";
  promptVersionId?: string;
  promptCandidateId?: string;
  passRate: number;
  averageScore?: number;
  totalCases: number;
  failedCases: number;
  reviewCases?: number;
  totalResults?: number;
  metadata?: Record<string, unknown>;
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
  evidenceRefs: EvidenceRef[];
  promptVersionId?: string;
  promptCandidateId?: string;
  model?: string;
  latencyMs?: number;
  estimatedCost?: number;
  tokenUsage?: Record<string, unknown>;
  confidence?: number;
  createdAt: string;
};

export type StoredHumanLabel = HumanLabel & {
  organizationId: string;
  projectId: string;
  notes?: string;
  updatedAt: string;
};

export type GraderCalibrationRun = {
  id: string;
  organizationId: string;
  projectId: string;
  graderId: string;
  status: "completed" | "review";
  agreement: number;
  totalLabels: number;
  disagreementCount: number;
  createdAt: string;
};

export type StoredGraderCalibrationResult = GraderCalibrationResult & {
  organizationId: string;
  projectId: string;
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
  promptBody: string;
  sourcePromptVersionId?: string;
  diffSummary?: string;
  expectedQualityLift: number;
  expectedCostDelta: number;
  expectedLatencyDeltaMs?: number;
  baselinePassRate?: number;
  candidatePassRate?: number;
  regressionRisk: RiskLevel;
  explanation: string;
  confidence?: number;
  evidenceRefs?: EvidenceRef[];
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
  confidence?: number;
  evidenceRefs?: EvidenceRef[];
  calculationBasis?: string;
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
  confidence?: number;
  evidenceRefs?: EvidenceRef[];
  calculationBasis?: string;
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
  evidenceRefs?: EvidenceRef[];
  confidence?: number;
  structuredSections?: Array<{
    title: string;
    body: string;
    evidenceRefs: EvidenceRef[];
  }>;
  createdAt: string;
};

export type ExportRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  type: "eval_pack_csv" | "issues_csv" | "audit_report_csv" | "audit_report_pdf" | "full_project_json";
  status: "queued" | "running" | "generated" | "failed";
  storageBucket: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  checksum?: string;
  receiptId?: string;
  metadata?: Record<string, unknown>;
  completedAt?: string;
  expiresAt?: string;
  createdAt: string;
};

export type DataOperationReceipt = {
  id: string;
  organizationId: string;
  projectId?: string;
  operation: "full_project_export" | "project_delete" | "raw_trace_purge" | "export_download";
  status: "requested" | "running" | "completed" | "failed";
  actorUserId: string;
  summary: string;
  metadata: Record<string, unknown>;
  exportId?: string;
  jobId?: string;
  createdAt: string;
  completedAt?: string;
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
  billing: BillingOverview;
  members: OrganizationMembership[];
  invitations: OrganizationInvitation[];
  supportRequests: SupportRequest[];
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
  evalResults: StoredEvalResult[];
  humanLabels: StoredHumanLabel[];
  graderCalibrationRuns: GraderCalibrationRun[];
  graderCalibrationResults: StoredGraderCalibrationResult[];
  failureClusters: FailureCluster[];
  promptVersions: PromptVersion[];
  promptCandidates: PromptCandidate[];
  routingRules: RoutingRule[];
  cacheRecommendations: CacheRecommendation[];
  reports: Report[];
  exports: ExportRecord[];
  dataOperationReceipts: DataOperationReceipt[];
  auditEvents: AuditEvent[];
};

export type CreateProjectInput = {
  name: string;
  workflowType: Project["workflowType"];
  objective: string;
  riskPreferences: string[];
  privacyMode: Project["privacyMode"];
};

export type CreateOrganizationInvitationInput = {
  email: string;
  role: OrganizationInvitation["role"];
};

export type UpdateOrganizationMemberInput = {
  membershipId: string;
  role: OrganizationMembership["role"];
};

export type CreateSupportRequestInput = {
  projectId?: string;
  requestType: SupportRequest["requestType"];
  priority?: SupportRequest["priority"];
  subject: string;
  message: string;
};

export type StartBillingCheckoutInput = {
  planId: BillingPlanId;
  returnUrl: string;
};

export type BillingSession = {
  url: string;
};

export type UpdateOrganizationBillingInput = Partial<
  Pick<
    OrganizationBilling,
    | "planId"
    | "status"
    | "stripeCustomerId"
    | "stripeSubscriptionId"
    | "stripePriceId"
    | "stripeCurrentPeriodStart"
    | "stripeCurrentPeriodEnd"
    | "trialEndsAt"
    | "cancelAtPeriodEnd"
    | "metadata"
  >
> & {
  organizationId?: string;
};

export type RecordUsageInput = {
  organizationId?: string;
  projectId?: string;
  metric: UsageMetric;
  quantity?: number;
  source: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
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

export type ProcessFullProjectExportInput = {
  projectId: string;
  exportId: string;
  jobId?: string;
};

export type DeleteProjectInput = {
  confirmationName: string;
};

export type ProcessProjectDeletionInput = {
  projectId: string;
  jobId: string;
  receiptId: string;
};

export type PurgeRawProjectDataInput = {
  projectId: string;
  traceImportId?: string;
  reason: "derived_only" | "retention_expired" | "project_delete";
  now?: string;
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
  passThreshold?: number;
  reviewThreshold?: number;
  rubric?: string;
  failureModes?: string[];
};

export type UpsertHumanLabelInput = {
  evalCaseId: string;
  graderId: string;
  score: number;
  status: EvalResult["status"];
  notes?: string;
};

export type EvalOpsStore = {
  ensureWorkspace(actor: ActorContext): Promise<WorkspaceState>;
  getWorkspaceState(actor: ActorContext, projectId?: string): Promise<WorkspaceState>;
  getProjectState(actor: ActorContext, projectId: string): Promise<WorkspaceState>;
  listOrganizations(actor: ActorContext): Promise<Array<{ organization: Organization; membership: OrganizationMembership }>>;
  getBillingOverview(actor: ActorContext): Promise<BillingOverview>;
  updateOrganizationBilling(actor: ActorContext, input: UpdateOrganizationBillingInput): Promise<OrganizationBilling>;
  recordUsage(actor: ActorContext, input: RecordUsageInput): Promise<StoredUsageEvent>;
  hasProcessedStripeEvent(eventId: string): Promise<boolean>;
  recordStripeEvent(input: { id: string; type: string; livemode: boolean; payload: Record<string, unknown> }): Promise<void>;
  findOrganizationBillingByStripeCustomer(stripeCustomerId: string): Promise<OrganizationBilling | undefined>;
  createOrganizationInvitation(actor: ActorContext, input: CreateOrganizationInvitationInput): Promise<{
    invitation: OrganizationInvitation;
    token: string;
  }>;
  acceptOrganizationInvitation(actor: ActorContext, token: string): Promise<OrganizationMembership>;
  updateOrganizationMember(actor: ActorContext, input: UpdateOrganizationMemberInput): Promise<OrganizationMembership>;
  removeOrganizationMember(actor: ActorContext, membershipId: string): Promise<void>;
  createSupportRequest(actor: ActorContext, input: CreateSupportRequestInput): Promise<SupportRequest>;
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
  requestFullProjectExport(actor: ActorContext, projectId: string): Promise<{
    exportRecord: ExportRecord;
    job: ProcessingJob;
    receipt: DataOperationReceipt;
  }>;
  processFullProjectExport(actor: ActorContext, input: ProcessFullProjectExportInput): Promise<{
    exportRecord: ExportRecord;
    job: ProcessingJob;
    receipt: DataOperationReceipt;
  }>;
  getExport(actor: ActorContext, exportId: string): Promise<{ record: ExportRecord; content: string | Uint8Array }>;
  requestProjectDeletion(actor: ActorContext, projectId: string, input: DeleteProjectInput): Promise<{
    job: ProcessingJob;
    receipt: DataOperationReceipt;
  }>;
  processProjectDeletion(actor: ActorContext, input: ProcessProjectDeletionInput): Promise<{
    receipt: DataOperationReceipt;
  }>;
  purgeRawProjectData(actor: ActorContext, input: PurgeRawProjectDataInput): Promise<DataOperationReceipt>;
  rerunEvaluation(actor: ActorContext, projectId: string): Promise<EvalRun>;
  upsertHumanLabel(actor: ActorContext, input: UpsertHumanLabelInput): Promise<StoredHumanLabel>;
  promotePromptCandidate(actor: ActorContext, projectId: string, candidateId: string): Promise<PromptVersion>;
};
