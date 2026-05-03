import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TraceImport } from "../domain/audit";
import {
  buildCsvExport,
  buildEvalArtifacts,
  inferTraceSourceType,
  parseTraceFile,
} from "../domain/trace-processing";
import type {
  ActorContext,
  AuditEvent,
  CacheRecommendation,
  CreateProjectInput,
  CreateTraceImportInput,
  EvalOpsStore,
  EvalRun,
  ExportRecord,
  FailureCluster,
  IssueComment,
  Organization,
  OrganizationMembership,
  ProcessingJob,
  Project,
  PromptCandidate,
  PromptVersion,
  Report,
  RoutingRule,
  StoredEvalCase,
  StoredGrader,
  StoredIssue,
  StoredTrace,
  UploadedFile,
  UserProfile,
  WorkspaceState,
} from "./types";

type LocalState = {
  organizations: Organization[];
  users: UserProfile[];
  memberships: OrganizationMembership[];
  projects: Project[];
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

const emptyState = (): LocalState => ({
  organizations: [],
  users: [],
  memberships: [],
  projects: [],
  traceImports: [],
  traces: [],
  uploadedFiles: [],
  processingJobs: [],
  evalCases: [],
  graders: [],
  issues: [],
  issueComments: [],
  evalRuns: [],
  failureClusters: [],
  promptVersions: [],
  promptCandidates: [],
  routingRules: [],
  cacheRecommendations: [],
  reports: [],
  exports: [],
  auditEvents: [],
});

type LocalStoreOptions = {
  rootDir: string;
};

export async function createLocalEvalOpsStore(options: LocalStoreOptions): Promise<EvalOpsStore> {
  await mkdir(options.rootDir, { recursive: true });
  await mkdir(join(options.rootDir, "uploads"), { recursive: true });
  await mkdir(join(options.rootDir, "exports"), { recursive: true });
  return new LocalEvalOpsStore(options.rootDir);
}

class LocalEvalOpsStore implements EvalOpsStore {
  private readonly statePath: string;
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly rootDir: string) {
    this.statePath = join(rootDir, "store.json");
  }

  private withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.writeQueue.then(operation, operation);
    this.writeQueue = next.catch(() => undefined);
    return next;
  }

  async ensureWorkspace(actor: ActorContext) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const now = new Date().toISOString();
    const userId = actor.userId;
    const organizationId = actor.organizationId || `org_${userId}`;
    let user = state.users.find((item) => item.id === userId);
    let organization = state.organizations.find((item) => item.id === organizationId);
    let membership = state.memberships.find(
      (item) => item.organizationId === organizationId && item.userId === userId,
    );

    if (!user) {
      user = {
        id: userId,
        email: actor.email || `${userId}@local.test`,
        displayName: actor.email?.split("@")[0] || "EvalOps Reviewer",
        createdAt: now,
      };
      state.users.push(user);
    }

    if (!organization) {
      organization = {
        id: organizationId,
        name: defaultOrganizationName(actor),
        slug: slugify(defaultOrganizationName(actor)),
        createdAt: now,
      };
      state.organizations.push(organization);
      state.auditEvents.push(
        audit(actor, organizationId, "organization", organizationId, "organization.created", {
          name: organization.name,
        }),
      );
    }

    if (!membership) {
      membership = {
        id: makeId("mem"),
        organizationId,
        userId,
        role: "owner",
        createdAt: now,
      };
      state.memberships.push(membership);
      state.auditEvents.push(
        audit(actor, organizationId, "membership", membership.id, "membership.created", {
          role: membership.role,
        }),
      );
    }

    await this.save(state);
    return selectWorkspace(state, organizationId, undefined, user, organization, membership);
    });
  }

  async getWorkspaceState(actor: ActorContext, projectId?: string) {
    const state = await this.load();
    const context = requireMembership(state, actor);
    return selectWorkspace(
      state,
      context.organization.id,
      projectId,
      context.user,
      context.organization,
      context.membership,
    );
  }

  async getProjectState(actor: ActorContext, projectId: string) {
    const workspace = await this.getWorkspaceState(actor, projectId);
    if (!workspace.activeProject) throw new Error("Project not found for this organization.");
    return workspace;
  }

  async createProject(actor: ActorContext, input: CreateProjectInput) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = ensureLocalMembership(state, actor);
    const now = new Date().toISOString();
    const project: Project = {
      id: makeId("proj"),
      organizationId: context.organization.id,
      name: input.name.trim(),
      workflowType: input.workflowType,
      objective: input.objective.trim(),
      riskPreferences: input.riskPreferences,
      privacyMode: input.privacyMode,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    state.projects.push(project);
    state.auditEvents.push(
      audit(actor, project.organizationId, "project", project.id, "project.created", {
        workflowType: project.workflowType,
        privacyMode: project.privacyMode,
      }),
    );
    seedPromptAndOptimization(state, actor, project);
    await this.save(state);
    return project;
    });
  }

  async createTraceImport(actor: ActorContext, input: CreateTraceImportInput) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const project = findProject(state, context.organization.id, input.projectId);
    const now = new Date().toISOString();
    const traceImportId = makeId("imp");
    const fileId = makeId("file");
    const checksum = createHash("sha256").update(input.text).digest("hex");
    const source = sourceFromFileName(input.fileName, input.contentType);
    const storagePath = `${project.organizationId}/${project.id}/${traceImportId}/${input.fileName}`;
    const importRecord: TraceImport = {
      id: traceImportId,
      source,
      name: input.fileName,
      importedAt: now,
      traces: 0,
      rows: 0,
      status: "processing",
      redactionStatus: "in_progress",
      primaryIntent: "Pending",
      riskLevel: "low",
    };
    const uploadedFile: UploadedFile = {
      id: fileId,
      organizationId: project.organizationId,
      projectId: project.id,
      traceImportId,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: Buffer.byteLength(input.text),
      storageBucket: "trace-uploads",
      storagePath,
      checksum,
      createdAt: now,
    };
    const job: ProcessingJob = {
      id: makeId("job"),
      organizationId: project.organizationId,
      projectId: project.id,
      traceImportId,
      action: "trace_import",
      status: "running",
      createdAt: now,
      startedAt: now,
    };

    state.traceImports.push(importRecord);
    state.uploadedFiles.push(uploadedFile);
    state.processingJobs.push(job);
    state.auditEvents.push(
      audit(actor, project.organizationId, "uploaded_file", fileId, "file.uploaded", {
        fileName: input.fileName,
        sizeBytes: uploadedFile.sizeBytes,
        storagePath,
      }),
      audit(actor, project.organizationId, "processing_job", job.id, "file.processing_started", {
        traceImportId,
      }),
    );
    await writeFile(join(this.rootDir, "uploads", checksum), input.text, "utf8");

    try {
      const parsed = parseTraceFile(input);
      const traces: StoredTrace[] = parsed.map((trace) => ({
        ...trace,
        id: makeId("trace"),
        organizationId: project.organizationId,
        projectId: project.id,
        traceImportId,
      }));
      state.traces.push(...traces);

      const artifacts = buildEvalArtifacts({ projectId: project.id, traces: parsed });
      upsertArtifacts(state, actor, project, artifacts, traces);

      const completedAt = new Date().toISOString();
      const primaryIntent = mostCommon(traces.map((trace) => trace.intent)) || "General Support";
      importRecord.traces = traces.length;
      importRecord.rows = traces.length;
      importRecord.status = "completed";
      importRecord.redactionStatus = parsed.some((trace) => trace.redactionHits.length > 0)
        ? "redacted"
        : "pending";
      importRecord.primaryIntent = primaryIntent;
      importRecord.riskLevel = traces.some((trace) => trace.riskLevel === "high")
        ? "high"
        : traces.some((trace) => trace.riskLevel === "medium")
          ? "medium"
          : "low";
      job.status = "completed";
      job.completedAt = completedAt;
      state.auditEvents.push(
        audit(actor, project.organizationId, "processing_job", job.id, "file.processing_completed", {
          traceCount: traces.length,
          issueCount: artifacts.issues.length,
        }),
      );
    } catch (error) {
      importRecord.status = "failed";
      importRecord.redactionStatus = "failed";
      job.status = "failed";
      job.errorMessage = error instanceof Error ? error.message : "Unknown processing error";
      job.completedAt = new Date().toISOString();
      state.auditEvents.push(
        audit(
          actor,
          project.organizationId,
          "processing_job",
          job.id,
          "file.processing_failed",
          { error: job.errorMessage },
          "failed",
        ),
      );
    }

    await this.save(state);
    return { importRecord, job };
    });
  }

  async updateIssue(actor: ActorContext, input: { issueId: string; status: StoredIssue["status"]; comment?: string }) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const issue = state.issues.find(
      (item) => item.id === input.issueId && item.organizationId === context.organization.id,
    );
    if (!issue) throw new Error("Issue not found for this organization.");
    issue.status = input.status;
    issue.updatedAt = new Date().toISOString();
    if (input.status === "resolved" || input.status === "ignored") {
      issue.resolvedAt = issue.updatedAt;
      issue.resolvedBy = actor.userId;
    } else {
      issue.resolvedAt = undefined;
      issue.resolvedBy = undefined;
    }
    state.auditEvents.push(
      audit(actor, issue.organizationId, "issue", issue.id, `issue.${input.status}`, {
        status: input.status,
      }),
    );
    if (input.comment?.trim()) {
      const comment: IssueComment = {
        id: makeId("comment"),
        organizationId: issue.organizationId,
        projectId: issue.projectId,
        issueId: issue.id,
        actorUserId: actor.userId,
        body: input.comment.trim(),
        createdAt: new Date().toISOString(),
      };
      state.issueComments.push(comment);
      state.auditEvents.push(
        audit(actor, issue.organizationId, "issue_comment", comment.id, "issue.comment.created", {
          issueId: issue.id,
        }),
      );
    }
    await this.save(state);
    return issue;
    });
  }

  async updateEvalCase(
    actor: ActorContext,
    input: {
      caseId: string;
      userInput?: string;
      expectedBehavior?: string;
      acceptanceCriteria?: string[];
      status?: StoredEvalCase["status"];
    },
  ) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const evalCase = state.evalCases.find(
      (item) => item.id === input.caseId && item.organizationId === context.organization.id,
    );
    if (!evalCase) throw new Error("Eval case not found for this organization.");
    if (input.userInput !== undefined) evalCase.userInput = input.userInput;
    if (input.expectedBehavior !== undefined) evalCase.expectedBehavior = input.expectedBehavior;
    if (input.acceptanceCriteria !== undefined) evalCase.acceptanceCriteria = input.acceptanceCriteria;
    if (input.status !== undefined) evalCase.status = input.status;
    evalCase.updatedAt = new Date().toISOString();
    state.auditEvents.push(
      audit(actor, evalCase.organizationId, "eval_case", evalCase.id, "eval_case.updated", {
        status: evalCase.status,
      }),
    );
    await this.save(state);
    return evalCase;
    });
  }

  async createExport(actor: ActorContext, projectId: string) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const project = findProject(state, context.organization.id, projectId);
    const evalCases = state.evalCases.filter((item) => item.projectId === project.id);
    const issues = state.issues.filter((item) => item.projectId === project.id);
    const content = buildCsvExport({ evalCases, issues });
    const exportRecord: ExportRecord = {
      id: makeId("exp"),
      organizationId: project.organizationId,
      projectId: project.id,
      type: "eval_pack_csv",
      status: "generated",
      storageBucket: "exports",
      storagePath: `${project.organizationId}/${project.id}/eval-pack.csv`,
      fileName: `${slugify(project.name)}-eval-pack.csv`,
      contentType: "text/csv",
      sizeBytes: Buffer.byteLength(content),
      createdAt: new Date().toISOString(),
    };
    state.exports.push(exportRecord);
    await writeFile(join(this.rootDir, "exports", exportRecord.id), content, "utf8");
    state.auditEvents.push(
      audit(actor, project.organizationId, "export", exportRecord.id, "export.generated", {
        type: exportRecord.type,
        caseCount: evalCases.length,
        issueCount: issues.length,
      }),
    );
    await this.save(state);
    return exportRecord;
    });
  }

  async getExport(actor: ActorContext, exportId: string) {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const record = state.exports.find(
      (item) => item.id === exportId && item.organizationId === context.organization.id,
    );
    if (!record) throw new Error("Export not found for this organization.");
    const content = await readFile(join(this.rootDir, "exports", record.id), "utf8");
    return { record, content };
  }

  async rerunEvaluation(actor: ActorContext, projectId: string) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const project = findProject(state, context.organization.id, projectId);
    const evalCases = state.evalCases.filter((item) => item.projectId === project.id);
    const failedCases = evalCases.filter((item) => item.status === "failed").length;
    const passRate = evalCases.length
      ? Math.round(((evalCases.length - failedCases) / evalCases.length) * 1000) / 10
      : 0;
    const run: EvalRun = {
      id: makeId("run"),
      organizationId: project.organizationId,
      projectId: project.id,
      status: "completed",
      passRate,
      totalCases: evalCases.length,
      failedCases,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    state.evalRuns.unshift(run);
    state.auditEvents.push(
      audit(actor, project.organizationId, "eval_run", run.id, "review_rule.executed", {
        totalCases: run.totalCases,
        failedCases: run.failedCases,
      }),
    );
    await this.save(state);
    return run;
    });
  }

  async promotePromptCandidate(actor: ActorContext, projectId: string, candidateId: string) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const project = findProject(state, context.organization.id, projectId);
    const candidate = state.promptCandidates.find(
      (item) => item.id === candidateId && item.projectId === project.id,
    );
    if (!candidate) throw new Error("Prompt candidate not found for this project.");
    const promptVersion: PromptVersion = {
      id: makeId("prompt"),
      organizationId: project.organizationId,
      projectId: project.id,
      label: candidate.title,
      prompt: candidate.explanation,
      status: "promoted",
      createdAt: new Date().toISOString(),
    };
    state.promptVersions.forEach((item) => {
      if (item.projectId === project.id) item.status = "candidate";
    });
    state.promptVersions.unshift(promptVersion);
    state.auditEvents.push(
      audit(actor, project.organizationId, "prompt_version", promptVersion.id, "prompt.promoted", {
        candidateId,
      }),
    );
    await this.save(state);
    return promptVersion;
    });
  }

  private async load(): Promise<LocalState> {
    let raw: string;
    try {
      raw = await readFile(this.statePath, "utf8");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return emptyState();
      }
      throw error;
    }

    try {
      return { ...emptyState(), ...(JSON.parse(raw) as LocalState) };
    } catch {
      throw new Error("Local EvalOps store state file is unreadable.");
    }
  }

  private async save(state: LocalState) {
    const tempPath = `${this.statePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
    await rename(tempPath, this.statePath);
  }
}

function ensureLocalMembership(state: LocalState, actor: ActorContext) {
  const organizationId = actor.organizationId || `org_${actor.userId}`;
  const now = new Date().toISOString();
  let user = state.users.find((item) => item.id === actor.userId);
  if (!user) {
    user = {
      id: actor.userId,
      email: actor.email || `${actor.userId}@local.test`,
      displayName: actor.email?.split("@")[0] || "EvalOps Reviewer",
      createdAt: now,
    };
    state.users.push(user);
  }
  let organization = state.organizations.find((item) => item.id === organizationId);
  if (!organization) {
    organization = {
      id: organizationId,
      name: defaultOrganizationName(actor),
      slug: slugify(defaultOrganizationName(actor)),
      createdAt: now,
    };
    state.organizations.push(organization);
    state.auditEvents.push(
      audit(actor, organizationId, "organization", organizationId, "organization.created", {
        name: organization.name,
      }),
    );
  }
  let membership = state.memberships.find(
    (item) => item.organizationId === organizationId && item.userId === actor.userId,
  );
  if (!membership) {
    membership = {
      id: makeId("mem"),
      organizationId,
      userId: actor.userId,
      role: "owner",
      createdAt: now,
    };
    state.memberships.push(membership);
  }
  return { user, organization, membership };
}

function requireMembership(state: LocalState, actor: ActorContext) {
  const organizationId = actor.organizationId || `org_${actor.userId}`;
  const user = state.users.find((item) => item.id === actor.userId);
  const organization = state.organizations.find((item) => item.id === organizationId);
  const membership = state.memberships.find(
    (item) => item.organizationId === organizationId && item.userId === actor.userId,
  );
  if (!user || !organization || !membership) {
    throw new Error("Workspace not found for this user.");
  }
  return { user, organization, membership };
}

function selectWorkspace(
  state: LocalState,
  organizationId: string,
  projectId: string | undefined,
  user: UserProfile,
  organization: Organization,
  membership: OrganizationMembership,
): WorkspaceState {
  const projects = state.projects.filter((item) => item.organizationId === organizationId);
  const activeProject =
    projects.find((item) => item.id === projectId) ||
    projects.find((item) => item.status === "active") ||
    projects[0];
  const currentProjectId = activeProject?.id;
  const byProject = <T extends { organizationId: string; projectId?: string }>(items: T[]) =>
    items.filter(
      (item) =>
        item.organizationId === organizationId &&
        (!currentProjectId || !item.projectId || item.projectId === currentProjectId),
    );
  return {
    organization,
    user,
    membership,
    projects,
    activeProject,
    traceImports: currentProjectId
      ? state.traceImports.filter((item) =>
          state.uploadedFiles.some(
            (file) => file.traceImportId === item.id && file.projectId === currentProjectId,
          ),
        )
      : [],
    traces: byProject(state.traces),
    uploadedFiles: byProject(state.uploadedFiles),
    processingJobs: byProject(state.processingJobs),
    evalCases: byProject(state.evalCases),
    graders: byProject(state.graders),
    issues: byProject(state.issues),
    issueComments: byProject(state.issueComments),
    evalRuns: byProject(state.evalRuns),
    failureClusters: byProject(state.failureClusters),
    promptVersions: byProject(state.promptVersions),
    promptCandidates: byProject(state.promptCandidates),
    routingRules: byProject(state.routingRules),
    cacheRecommendations: byProject(state.cacheRecommendations),
    reports: byProject(state.reports),
    exports: byProject(state.exports),
    auditEvents: state.auditEvents
      .filter((item) => item.organizationId === organizationId)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

function findProject(state: LocalState, organizationId: string, projectId: string) {
  const project = state.projects.find(
    (item) => item.id === projectId && item.organizationId === organizationId,
  );
  if (!project) throw new Error("Project not found for this organization.");
  return project;
}

function upsertArtifacts(
  state: LocalState,
  actor: ActorContext,
  project: Project,
  artifacts: ReturnType<typeof buildEvalArtifacts>,
  traces: StoredTrace[],
) {
  const now = new Date().toISOString();
  const existingCaseIds = new Set(state.evalCases.map((item) => item.id));
  const evalCases: StoredEvalCase[] = artifacts.evalCases
    .filter((item) => !existingCaseIds.has(item.id))
    .map((item, index) => ({
      ...item,
      organizationId: project.organizationId,
      projectId: project.id,
      traceId: traces[index]?.id,
      createdAt: now,
      updatedAt: now,
    }));
  state.evalCases.push(...evalCases);

  const existingGraderIds = new Set(state.graders.map((item) => item.id));
  state.graders.push(
    ...artifacts.graders
      .filter((item) => !existingGraderIds.has(item.id))
      .map((item) => ({
        ...item,
        organizationId: project.organizationId,
        projectId: project.id,
        active: true,
        createdAt: now,
        updatedAt: now,
      })),
  );

  const issues: StoredIssue[] = artifacts.issues.map((item) => ({
    ...item,
    organizationId: project.organizationId,
    projectId: project.id,
    traceId: evalCases.find((evalCase) => evalCase.id === item.evalCaseId)?.traceId,
    createdAt: now,
    updatedAt: now,
  }));
  state.issues.push(...issues);
  state.auditEvents.push(
    ...evalCases.map((item) =>
      audit(actor, project.organizationId, "eval_case", item.id, "extraction_result.created", {
        intent: item.intent,
        status: item.status,
      }),
    ),
    ...issues.map((item) =>
      audit(actor, project.organizationId, "issue", item.id, "issue.created", {
        severity: item.severity,
        status: item.status,
      }),
    ),
  );

  const failedCases = evalCases.filter((item) => item.status === "failed").length;
  const passRate = evalCases.length
    ? Math.round(((evalCases.length - failedCases) / evalCases.length) * 1000) / 10
    : 0;
  state.evalRuns.unshift({
    id: makeId("run"),
    organizationId: project.organizationId,
    projectId: project.id,
    status: "completed",
    passRate,
    totalCases: evalCases.length,
    failedCases,
    startedAt: now,
    completedAt: now,
  });
  state.failureClusters = [
    ...state.failureClusters.filter((item) => item.projectId !== project.id),
    ...buildFailureClusters(project, issues, now),
  ];
  state.reports.unshift({
    id: makeId("report"),
    organizationId: project.organizationId,
    projectId: project.id,
    title: "Eval Debt Audit Report",
    summary: artifacts.report.summary,
    readinessScore: artifacts.report.readinessScore,
    recommendations: artifacts.report.recommendations,
    createdAt: now,
  } satisfies Report);
  state.auditEvents.push(
    audit(actor, project.organizationId, "eval_run", state.evalRuns[0].id, "review_rule.executed", {
      passRate,
      totalCases: evalCases.length,
    }),
    audit(actor, project.organizationId, "report", state.reports[0].id, "report.generated", {
      readinessScore: artifacts.report.readinessScore,
    }),
  );
  seedPromptAndOptimization(state, actor, project);
}

function buildFailureClusters(project: Project, issues: StoredIssue[], now: string): FailureCluster[] {
  const grouped = new Map<string, StoredIssue[]>();
  issues.forEach((issue) => {
    const label = issue.title;
    grouped.set(label, [...(grouped.get(label) || []), issue]);
  });
  return Array.from(grouped.entries()).map(([label, items]) => ({
    id: makeId("cluster"),
    organizationId: project.organizationId,
    projectId: project.id,
    label,
    severity: items.some((item) => item.severity === "high") ? "high" : "medium",
    issueCount: items.length,
    percent: issues.length ? Math.round((items.length / issues.length) * 1000) / 10 : 0,
    createdAt: now,
  }));
}

function seedPromptAndOptimization(state: LocalState, actor: ActorContext, project: Project) {
  if (state.promptVersions.some((item) => item.projectId === project.id)) return;
  const now = new Date().toISOString();
  state.promptVersions.push({
    id: makeId("prompt"),
    organizationId: project.organizationId,
    projectId: project.id,
    label: "Current production prompt",
    prompt: "Answer from available context, avoid unsupported claims, and escalate high-risk cases.",
    status: "current",
    createdAt: now,
  });
  state.promptCandidates.push(
    {
      id: makeId("cand"),
      organizationId: project.organizationId,
      projectId: project.id,
      title: "Escalation-first support prompt",
      expectedQualityLift: 12,
      expectedCostDelta: -3,
      regressionRisk: "low",
      explanation: "Adds explicit high-friction detection and human handoff criteria.",
      createdAt: now,
    },
    {
      id: makeId("cand"),
      organizationId: project.organizationId,
      projectId: project.id,
      title: "Billing-safe prompt",
      expectedQualityLift: 8,
      expectedCostDelta: 1,
      regressionRisk: "medium",
      explanation: "Tightens refund and invoice language with confirmation steps.",
      createdAt: now,
    },
  );
  state.routingRules.push(
    ...["General Support", "Billing", "Refunds", "Escalation", "Privacy"].map((intent, index) => ({
      id: makeId("route"),
      organizationId: project.organizationId,
      projectId: project.id,
      intent,
      model: index >= 3 ? "gpt-4.1" : "gpt-4.1-mini",
      fallback: index >= 3 ? "Human review" : "gpt-4.1",
      qualityScore: 86 - index * 2,
      estimatedCost: index >= 3 ? 0.028 : 0.012,
      estimatedLatencyMs: index >= 3 ? 2100 : 1200,
      trafficShare: Math.max(5, 35 - index * 6),
      createdAt: now,
    })),
  );
  state.cacheRecommendations.push(
    {
      id: makeId("cache"),
      organizationId: project.organizationId,
      projectId: project.id,
      title: "Move static policy guidance before dynamic user context",
      detail: "This increases cacheable prefix length without changing model behavior.",
      impact: "high",
      estimatedMonthlySavings: 680,
      createdAt: now,
    },
    {
      id: makeId("cache"),
      organizationId: project.organizationId,
      projectId: project.id,
      title: "Standardize tool schema ordering",
      detail: "Stable JSON key ordering improves prompt cache hit rate across support turns.",
      impact: "medium",
      estimatedMonthlySavings: 240,
      createdAt: now,
    },
  );
  state.auditEvents.push(
    audit(actor, project.organizationId, "prompt_version", project.id, "optimizer.initialized", {
      candidateCount: 2,
    }),
  );
}

function audit(
  actor: ActorContext,
  organizationId: string,
  entityType: string,
  entityId: string,
  action: string,
  metadata: Record<string, unknown>,
  status: AuditEvent["status"] = "succeeded",
): AuditEvent {
  return {
    id: makeId("evt"),
    organizationId,
    actorUserId: actor.userId,
    entityType,
    entityId,
    action,
    status,
    metadata,
    createdAt: new Date().toISOString(),
  };
}

function sourceFromFileName(fileName: string, contentType = ""): TraceImport["source"] {
  return inferTraceSourceType(fileName, contentType);
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function makeId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function defaultOrganizationName(actor: ActorContext) {
  return actor.email ? `${actor.email.split("@")[0]}'s workspace` : "EvalOps Workspace";
}
