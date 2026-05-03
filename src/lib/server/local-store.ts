import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TraceImport } from "../domain/audit";
import {
  buildCsvExport,
  inferTraceSourceType,
  type NormalizedTrace,
  parseTraceFile,
} from "../domain/trace-processing";
import { executeDeterministicGrader, summarizeEvalResults } from "../domain/eval-execution";
import { generateAuditArtifacts, type AuditArtifacts } from "@/lib/ai/openai-audit-generation";
import { buildAuditReportPdf } from "./audit-report-pdf";
import { ApiError } from "./auth";
import {
  buildFullProjectExportPackage,
  checksumContent,
  createReceipt,
  encodeFullProjectExportPackage,
  rawRetentionExpiryFrom,
} from "./privacy-operations";
import type {
  ActorContext,
  AuditEvent,
  CacheRecommendation,
  DataOperationReceipt,
  DeleteProjectInput,
  CreateProjectInput,
  CreateExportInput,
  CreateTraceImportInput,
  EvalOpsStore,
  EvalRun,
  ExportRecord,
  FailureCluster,
  GraderCalibrationRun,
  StoredGraderCalibrationResult,
  StoredHumanLabel,
  IssueComment,
  Organization,
  OrganizationMembership,
  ProcessingJob,
  ProcessFullProjectExportInput,
  ProcessProjectDeletionInput,
  ProcessTraceImportInput,
  Project,
  PromptCandidate,
  PromptVersion,
  PurgeRawProjectDataInput,
  Report,
  RoutingRule,
  StoredEvalCase,
  StoredEvalResult,
  StoredGrader,
  StoredIssue,
  UpdateGraderInput,
  UpsertHumanLabelInput,
  UpdateProjectSettingsInput,
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
  evalResults: [],
  humanLabels: [],
  graderCalibrationRuns: [],
  graderCalibrationResults: [],
  failureClusters: [],
  promptVersions: [],
  promptCandidates: [],
  routingRules: [],
  cacheRecommendations: [],
  reports: [],
  exports: [],
  dataOperationReceipts: [],
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

  async updateProjectSettings(actor: ActorContext, projectId: string, input: UpdateProjectSettingsInput) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const project = findProject(state, context.organization.id, projectId);
    const shouldPurgeRaw =
      input.privacyMode === "derived_only" &&
      (state.uploadedFiles.some((item) => item.projectId === project.id && !item.rawPurgedAt) ||
        state.traces.some((item) => item.projectId === project.id && !item.rawPurgedAt));
    if (input.privacyMode !== undefined) project.privacyMode = input.privacyMode;
    if (input.riskPreferences !== undefined) project.riskPreferences = normalizeList(input.riskPreferences);
    project.updatedAt = new Date().toISOString();
    state.auditEvents.push(
      audit(actor, project.organizationId, "project", project.id, "project.settings.updated", {
        privacyMode: project.privacyMode,
        riskPreferenceCount: project.riskPreferences.length,
      }),
    );
    if (shouldPurgeRaw) {
      await purgeRawProjectDataInState(state, this.rootDir, actor, {
        projectId: project.id,
        reason: "derived_only",
      });
    }
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
    const duplicate = state.uploadedFiles.find(
      (item) =>
        item.organizationId === project.organizationId &&
        item.projectId === project.id &&
        item.checksum === checksum,
    );
    if (duplicate) {
      throw new ApiError(
        409,
        `This file has already been imported for this project as ${duplicate.fileName}.`,
        "duplicate_upload",
      );
    }
    const source = sourceFromFileName(input.fileName, input.contentType);
    const storagePath = `${project.organizationId}/${project.id}/${traceImportId}/${input.fileName}`;
    const rawRetentionExpiresAt =
      project.privacyMode === "short_retention"
        ? rawRetentionExpiryFrom(now)
        : project.privacyMode === "derived_only"
          ? now
          : undefined;
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
      rawRetentionExpiresAt,
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
      rawRetentionExpiresAt,
      createdAt: now,
    };
    const job: ProcessingJob = {
      id: makeId("job"),
      organizationId: project.organizationId,
      projectId: project.id,
      traceImportId,
      action: "trace_import",
      status: "queued",
      metadata: { fileName: input.fileName, checksum },
      createdAt: now,
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
      audit(actor, project.organizationId, "processing_job", job.id, "file.processing_queued", {
        traceImportId,
      }),
    );
    await writeFile(join(this.rootDir, "uploads", checksum), input.text, "utf8");

    await this.save(state);
    return { importRecord, job };
    });
  }

  async processTraceImport(actor: ActorContext, input: ProcessTraceImportInput) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const project = findProject(state, context.organization.id, input.projectId);
    const importRecord = state.traceImports.find((item) => item.id === input.traceImportId);
    if (!importRecord) throw new Error("Trace import not found for this organization.");
    const uploadedFile = state.uploadedFiles.find(
      (item) =>
        item.traceImportId === input.traceImportId &&
        item.projectId === project.id &&
        item.organizationId === project.organizationId,
    );
    if (!uploadedFile) throw new Error("Uploaded file not found for this trace import.");
    const job =
      state.processingJobs.find((item) => item.id === input.jobId && item.projectId === project.id) ||
      state.processingJobs.find((item) => item.traceImportId === input.traceImportId && item.projectId === project.id);
    if (!job) throw new Error("Processing job not found for this trace import.");

    if (importRecord.status === "completed" && job.status === "completed") {
      return { importRecord, job };
    }

    job.status = "running";
    job.startedAt = job.startedAt || new Date().toISOString();
    job.errorMessage = undefined;
    job.metadata = { ...(job.metadata || {}), sourceTraceImportId: importRecord.id };
    importRecord.status = "processing";
    importRecord.redactionStatus = "in_progress";
    state.auditEvents.push(
      audit(actor, project.organizationId, "processing_job", job.id, "file.processing_started", {
        traceImportId: importRecord.id,
      }),
    );

    try {
      const text = await readFile(join(this.rootDir, "uploads", uploadedFile.checksum), "utf8");
      const parsed = parseTraceFile({
        fileName: uploadedFile.fileName,
        contentType: uploadedFile.contentType,
        text,
      });
      state.traces = state.traces.filter((trace) => trace.traceImportId !== importRecord.id);
      const traces: StoredTrace[] = parsed.map((trace) => ({
        ...trace,
        id: makeId("trace"),
        organizationId: project.organizationId,
        projectId: project.id,
        traceImportId: importRecord.id,
        rawRetentionExpiresAt: importRecord.rawRetentionExpiresAt || uploadedFile.rawRetentionExpiresAt,
      }));
      state.traces.push(...traces);

      const artifacts = await generateAuditArtifacts({
        project,
        traces: traces as Array<NormalizedTrace & { id: string }>,
      });
      upsertArtifacts(state, actor, project, artifacts, traces, {
        traceImportId: importRecord.id,
        jobId: job.id,
      });

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
      job.completedAt = new Date().toISOString();
      job.metadata = {
        ...(job.metadata || {}),
        generation: artifacts.generationMetadata,
      };
      state.auditEvents.push(
        audit(actor, project.organizationId, "processing_job", job.id, "file.processing_completed", {
          traceCount: traces.length,
          issueCount: artifacts.issues.length,
          generation: artifacts.generationMetadata,
        }),
      );
      if (project.privacyMode === "derived_only") {
        await purgeRawProjectDataInState(state, this.rootDir, actor, {
          projectId: project.id,
          traceImportId: importRecord.id,
          reason: "derived_only",
          now: job.completedAt,
        });
      }
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

  async updateGrader(actor: ActorContext, input: UpdateGraderInput) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const grader = state.graders.find(
      (item) => item.id === input.graderId && item.organizationId === context.organization.id,
    );
    if (!grader) throw new Error("Grader not found for this organization.");
    if (input.description !== undefined) grader.description = input.description.trim();
    if (input.active !== undefined) grader.active = input.active;
    if (input.model !== undefined) grader.model = input.model?.trim() || undefined;
    if (input.passThreshold !== undefined) grader.passThreshold = input.passThreshold;
    if (input.reviewThreshold !== undefined) grader.reviewThreshold = input.reviewThreshold;
    if (input.rubric !== undefined) grader.rubric = input.rubric.trim();
    if (input.failureModes !== undefined) grader.failureModes = normalizeList(input.failureModes);
    grader.updatedAt = new Date().toISOString();
    state.auditEvents.push(
      audit(actor, grader.organizationId, "grader", grader.id, "grader.updated", {
        active: grader.active,
        model: grader.model || null,
      }),
    );
    await this.save(state);
    return grader;
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

  async createExport(actor: ActorContext, projectId: string, input: CreateExportInput = {}) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const project = findProject(state, context.organization.id, projectId);
    const evalCases = state.evalCases.filter((item) => item.projectId === project.id);
    const issues = state.issues.filter((item) => item.projectId === project.id);
    const type = input.type || "eval_pack_csv";
    const workspaceState = selectWorkspace(
      state,
      context.organization.id,
      project.id,
      context.user,
      context.organization,
      context.membership,
    );
    const content =
      type === "audit_report_pdf"
        ? await buildAuditReportPdfOrThrow(workspaceState)
        : buildCsvExport({ evalCases, issues });
    const contentType = type === "audit_report_pdf" ? "application/pdf" : "text/csv";
    const fileName =
      type === "audit_report_pdf"
        ? `${slugify(project.name)}-audit-report.pdf`
        : `${slugify(project.name)}-eval-pack.csv`;
    const exportRecord: ExportRecord = {
      id: makeId("exp"),
      organizationId: project.organizationId,
      projectId: project.id,
      type,
      status: "generated",
      storageBucket: "exports",
      storagePath: `${project.organizationId}/${project.id}/${fileName}`,
      fileName,
      contentType,
      sizeBytes: typeof content === "string" ? Buffer.byteLength(content) : content.byteLength,
      createdAt: new Date().toISOString(),
    };
    state.exports.push(exportRecord);
    await writeFile(join(this.rootDir, "exports", exportRecord.id), content);
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
    const content =
      record.contentType === "application/pdf"
        ? await readFile(join(this.rootDir, "exports", record.id))
        : await readFile(join(this.rootDir, "exports", record.id), "utf8");
    return { record, content };
  }

  async requestFullProjectExport(actor: ActorContext, projectId: string) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const project = findProject(state, context.organization.id, projectId);
    const now = new Date().toISOString();
    const fileName = `${slugify(project.name)}-full-project-export.json`;
    const exportRecord: ExportRecord = {
      id: makeId("exp"),
      organizationId: project.organizationId,
      projectId: project.id,
      type: "full_project_json",
      status: "queued",
      storageBucket: "exports",
      storagePath: `${project.organizationId}/${project.id}/${Date.now()}-${fileName}`,
      fileName,
      contentType: "application/json",
      sizeBytes: 0,
      metadata: { requestedBy: actor.userId },
      createdAt: now,
    };
    const job: ProcessingJob = {
      id: makeId("job"),
      organizationId: project.organizationId,
      projectId: project.id,
      action: "project_export",
      status: "queued",
      metadata: { exportId: exportRecord.id, type: exportRecord.type },
      createdAt: now,
    };
    const receipt = createReceipt({
      id: makeId("receipt"),
      organizationId: project.organizationId,
      projectId: project.id,
      operation: "full_project_export",
      status: "requested",
      actorUserId: actor.userId,
      summary: `Full project export requested for ${project.name}.`,
      metadata: { exportId: exportRecord.id, projectName: project.name },
      exportId: exportRecord.id,
      jobId: job.id,
      createdAt: now,
    });
    exportRecord.receiptId = receipt.id;
    state.exports.unshift(exportRecord);
    state.processingJobs.unshift(job);
    state.dataOperationReceipts.unshift(receipt);
    state.auditEvents.push(
      audit(actor, project.organizationId, "export", exportRecord.id, "project_export.requested", {
        projectId: project.id,
        receiptId: receipt.id,
      }),
    );
    await this.save(state);
    return { exportRecord, job, receipt };
    });
  }

  async processFullProjectExport(actor: ActorContext, input: ProcessFullProjectExportInput) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const project = findProject(state, context.organization.id, input.projectId);
    const exportRecord = state.exports.find(
      (item) => item.id === input.exportId && item.projectId === project.id,
    );
    if (!exportRecord) throw new Error("Full project export not found for this project.");
    const job =
      state.processingJobs.find((item) => item.id === input.jobId && item.projectId === project.id) ||
      state.processingJobs.find(
        (item) => item.projectId === project.id && item.metadata?.exportId === exportRecord.id,
      );
    if (!job) throw new Error("Full project export job not found.");
    const receipt = state.dataOperationReceipts.find(
      (item) => item.id === exportRecord.receiptId || item.exportId === exportRecord.id,
    );
    if (!receipt) throw new Error("Full project export receipt not found.");
    if (exportRecord.status === "generated" && job.status === "completed" && receipt.status === "completed") {
      return { exportRecord, job, receipt };
    }

    const now = new Date().toISOString();
    exportRecord.status = "running";
    job.status = "running";
    job.startedAt = job.startedAt || now;
    receipt.status = "running";
    const workspaceState = selectWorkspace(
      state,
      context.organization.id,
      project.id,
      context.user,
      context.organization,
      context.membership,
    );
    const content = encodeFullProjectExportPackage(
      buildFullProjectExportPackage(workspaceState, {
        exportId: exportRecord.id,
        requestedBy: actor.userId,
        generatedAt: now,
      }),
    );
    const checksum = checksumContent(content);
    await writeFile(join(this.rootDir, "exports", exportRecord.id), content, "utf8");
    exportRecord.status = "generated";
    exportRecord.sizeBytes = Buffer.byteLength(content);
    exportRecord.checksum = checksum;
    exportRecord.completedAt = now;
    exportRecord.metadata = {
      ...(exportRecord.metadata || {}),
      checksum,
      recordCounts: {
        traces: workspaceState.traces.length,
        evalCases: workspaceState.evalCases.length,
        graders: workspaceState.graders.length,
        reports: workspaceState.reports.length,
      },
    };
    job.status = "completed";
    job.completedAt = now;
    job.metadata = { ...(job.metadata || {}), checksum, sizeBytes: exportRecord.sizeBytes };
    receipt.status = "completed";
    receipt.completedAt = now;
    receipt.summary = `Full project export generated for ${project.name}.`;
    receipt.metadata = {
      ...receipt.metadata,
      checksum,
      sizeBytes: exportRecord.sizeBytes,
      fileName: exportRecord.fileName,
    };
    state.auditEvents.push(
      audit(actor, project.organizationId, "export", exportRecord.id, "project_export.completed", {
        projectId: project.id,
        checksum,
        sizeBytes: exportRecord.sizeBytes,
        receiptId: receipt.id,
      }),
    );
    await this.save(state);
    return { exportRecord, job, receipt };
    });
  }

  async requestProjectDeletion(actor: ActorContext, projectId: string, input: DeleteProjectInput) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const project = findProject(state, context.organization.id, projectId);
    if (input.confirmationName.trim() !== project.name) {
      throw new ApiError(400, "Type the project name exactly to confirm deletion.", "confirmation_mismatch");
    }
    const now = new Date().toISOString();
    const job: ProcessingJob = {
      id: makeId("job"),
      organizationId: project.organizationId,
      projectId: project.id,
      action: "project_delete",
      status: "queued",
      metadata: { projectName: project.name },
      createdAt: now,
    };
    const receipt = createReceipt({
      id: makeId("receipt"),
      organizationId: project.organizationId,
      projectId: project.id,
      operation: "project_delete",
      status: "requested",
      actorUserId: actor.userId,
      summary: `Project deletion requested for ${project.name}.`,
      metadata: { projectName: project.name },
      jobId: job.id,
      createdAt: now,
    });
    state.processingJobs.unshift(job);
    state.dataOperationReceipts.unshift(receipt);
    state.auditEvents.push(
      audit(actor, project.organizationId, "project", project.id, "project_delete.requested", {
        projectName: project.name,
        receiptId: receipt.id,
      }),
    );
    await this.save(state);
    return { job, receipt };
    });
  }

  async processProjectDeletion(actor: ActorContext, input: ProcessProjectDeletionInput) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const project = findProject(state, context.organization.id, input.projectId);
    const job = state.processingJobs.find((item) => item.id === input.jobId && item.projectId === project.id);
    if (!job) throw new Error("Project deletion job not found.");
    const receipt = state.dataOperationReceipts.find(
      (item) => item.id === input.receiptId && item.projectId === project.id,
    );
    if (!receipt) throw new Error("Project deletion receipt not found.");
    const now = new Date().toISOString();
    job.status = "running";
    job.startedAt = job.startedAt || now;
    receipt.status = "running";
    const deletedCounts = countProjectRecords(state, project.id);
    const uploadedFiles = state.uploadedFiles.filter((item) => item.projectId === project.id);
    const exports = state.exports.filter((item) => item.projectId === project.id);
    await Promise.all([
      ...uploadedFiles.map((file) => rm(join(this.rootDir, "uploads", file.checksum), { force: true })),
      ...exports.map((record) => rm(join(this.rootDir, "exports", record.id), { force: true })),
    ]);
    removeProjectRecords(state, project.id);
    job.status = "completed";
    job.completedAt = now;
    receipt.status = "completed";
    receipt.completedAt = now;
    receipt.summary = `Project ${project.name} and associated storage objects were deleted.`;
    receipt.metadata = {
      ...receipt.metadata,
      deletedCounts,
      storageObjectsDeleted: uploadedFiles.length + exports.length,
      completedAt: now,
    };
    state.auditEvents.push(
      audit(actor, project.organizationId, "project", project.id, "project_delete.completed", {
        projectName: project.name,
        deletedCounts,
        storageObjectsDeleted: uploadedFiles.length + exports.length,
        receiptId: receipt.id,
      }),
    );
    await this.save(state);
    return { receipt };
    });
  }

  async purgeRawProjectData(actor: ActorContext, input: PurgeRawProjectDataInput) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    findProject(state, context.organization.id, input.projectId);
    const receipt = await purgeRawProjectDataInState(state, this.rootDir, actor, input);
    await this.save(state);
    return receipt;
    });
  }

  async rerunEvaluation(actor: ActorContext, projectId: string) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const project = findProject(state, context.organization.id, projectId);
    const evalCases = state.evalCases.filter((item) => item.projectId === project.id);
    const activeGraders = state.graders.filter((item) => item.projectId === project.id && item.active);
    const currentPrompt = state.promptVersions.find((item) => item.projectId === project.id && item.status === "current") ||
      state.promptVersions.find((item) => item.projectId === project.id);
    const now = new Date().toISOString();
    const run: EvalRun = {
      id: makeId("run"),
      organizationId: project.organizationId,
      projectId: project.id,
      status: "running",
      runType: "manual",
      promptVersionId: currentPrompt?.id,
      passRate: 0,
      totalCases: evalCases.length,
      failedCases: 0,
      reviewCases: 0,
      totalResults: 0,
      startedAt: now,
    };
    const results = evalCases.flatMap((evalCase) =>
      activeGraders.map((grader) =>
        executeDeterministicGrader({
          evalCase,
          grader,
          trace: evalCase.traceId ? state.traces.find((trace) => trace.id === evalCase.traceId) : undefined,
          evalRunId: run.id,
          promptVersionId: currentPrompt?.id,
          now,
        }),
      ),
    ).map((result) => ({
      ...result,
      organizationId: project.organizationId,
      projectId: project.id,
    }));
    const summary = summarizeEvalResults(results);
    run.status = "completed";
    run.passRate = summary.passRate;
    run.averageScore = summary.averageScore;
    run.failedCases = summary.failedCases;
    run.reviewCases = summary.reviewCases;
    run.totalResults = results.length;
    run.completedAt = new Date().toISOString();
    state.evalRuns.unshift(run);
    state.evalResults = [
      ...results,
      ...state.evalResults.filter((item) => item.projectId !== project.id || item.evalRunId !== run.id),
    ];
    evalCases.forEach((evalCase) => {
      const caseResults = results.filter((result) => result.evalCaseId === evalCase.id);
      const score = caseResults.length
        ? Math.round(caseResults.reduce((total, result) => total + result.score, 0) / caseResults.length)
        : evalCase.lastResult;
      evalCase.lastResult = score;
      evalCase.status = caseResults.some((result) => result.status === "failed")
        ? "failed"
        : caseResults.some((result) => result.status === "review")
          ? "review"
          : "passed";
      evalCase.updatedAt = run.completedAt || now;
    });
    state.auditEvents.push(
      audit(actor, project.organizationId, "eval_run", run.id, "review_rule.executed", {
        totalCases: run.totalCases,
        totalResults: run.totalResults,
        failedCases: run.failedCases,
        passRate: run.passRate,
      }),
    );
    await this.save(state);
    return run;
    });
  }

  async upsertHumanLabel(actor: ActorContext, input: UpsertHumanLabelInput) {
    return this.withWriteLock(async () => {
    const state = await this.load();
    const context = requireMembership(state, actor);
    const evalCase = state.evalCases.find(
      (item) => item.id === input.evalCaseId && item.organizationId === context.organization.id,
    );
    if (!evalCase) throw new Error("Eval case not found for this organization.");
    const grader = state.graders.find(
      (item) => item.id === input.graderId && item.projectId === evalCase.projectId,
    );
    if (!grader) throw new Error("Grader not found for this eval case.");
    const now = new Date().toISOString();
    const existing = state.humanLabels.find(
      (item) => item.evalCaseId === evalCase.id && item.graderId === grader.id,
    );
    const label: StoredHumanLabel = {
      id: existing?.id || makeId("label"),
      organizationId: evalCase.organizationId,
      projectId: evalCase.projectId,
      evalCaseId: evalCase.id,
      graderId: grader.id,
      score: input.score,
      status: input.status,
      notes: input.notes?.trim() || undefined,
      labeledBy: actor.userId,
      labeledAt: existing?.labeledAt || now,
      updatedAt: now,
    };
    state.humanLabels = [
      label,
      ...state.humanLabels.filter((item) => item.id !== label.id),
    ];
    upsertCalibrationForLabel(state, actor, label);
    state.auditEvents.push(
      audit(actor, label.organizationId, "human_label", label.id, "human_label.upserted", {
        evalCaseId: label.evalCaseId,
        graderId: label.graderId,
        status: label.status,
      }),
    );
    await this.save(state);
    return label;
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
      prompt: candidate.promptBody,
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
    evalResults: byProject(state.evalResults),
    humanLabels: byProject(state.humanLabels),
    graderCalibrationRuns: byProject(state.graderCalibrationRuns),
    graderCalibrationResults: byProject(state.graderCalibrationResults),
    failureClusters: byProject(state.failureClusters),
    promptVersions: byProject(state.promptVersions),
    promptCandidates: byProject(state.promptCandidates),
    routingRules: byProject(state.routingRules),
    cacheRecommendations: byProject(state.cacheRecommendations),
    reports: byProject(state.reports),
    exports: byProject(state.exports),
    dataOperationReceipts: state.dataOperationReceipts
      .filter((item) => item.organizationId === organizationId)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
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

async function purgeRawProjectDataInState(
  state: LocalState,
  rootDir: string,
  actor: ActorContext,
  input: PurgeRawProjectDataInput,
) {
  const now = input.now || new Date().toISOString();
  const project = state.projects.find((item) => item.id === input.projectId);
  if (!project) throw new Error("Project not found for this organization.");
  const matchesTraceImport = (traceImportId?: string) =>
    !input.traceImportId || traceImportId === input.traceImportId;
  const files = state.uploadedFiles.filter(
    (file) => file.projectId === input.projectId && matchesTraceImport(file.traceImportId) && !file.rawPurgedAt,
  );
  const traces = state.traces.filter(
    (trace) => trace.projectId === input.projectId && matchesTraceImport(trace.traceImportId) && !trace.rawPurgedAt,
  );
  const imports = state.traceImports.filter((traceImport) =>
    files.some((file) => file.traceImportId === traceImport.id) ||
    traces.some((trace) => trace.traceImportId === traceImport.id),
  );

  await Promise.all(files.map((file) => rm(join(rootDir, "uploads", file.checksum), { force: true })));
  files.forEach((file) => {
    file.rawPurgedAt = now;
    file.storageDeletedAt = now;
  });
  traces.forEach((trace) => {
    trace.input = null;
    trace.output = null;
    trace.metadata = null;
    trace.rawPurgedAt = now;
  });
  imports.forEach((traceImport) => {
    traceImport.rawPurgedAt = now;
  });

  const receipt = createReceipt({
    id: makeId("receipt"),
    organizationId: project.organizationId,
    projectId: project.id,
    operation: "raw_trace_purge",
    status: "completed",
    actorUserId: actor.userId,
    summary: `Raw trace data purged for ${project.name}.`,
    metadata: {
      reason: input.reason,
      traceImportId: input.traceImportId,
      filesPurged: files.length,
      tracesPurged: traces.length,
    },
    createdAt: now,
    completedAt: now,
  });
  state.dataOperationReceipts.unshift(receipt);
  state.auditEvents.push(
    audit(actor, project.organizationId, "project", project.id, "raw_trace_purge.completed", {
      reason: input.reason,
      traceImportId: input.traceImportId,
      filesPurged: files.length,
      tracesPurged: traces.length,
      receiptId: receipt.id,
    }),
  );
  return receipt;
}

function countProjectRecords(state: LocalState, projectId: string) {
  return {
    traceImports: state.traceImports.filter((item) =>
      state.uploadedFiles.some((file) => file.projectId === projectId && file.traceImportId === item.id),
    ).length,
    traces: state.traces.filter((item) => item.projectId === projectId).length,
    uploadedFiles: state.uploadedFiles.filter((item) => item.projectId === projectId).length,
    processingJobs: state.processingJobs.filter((item) => item.projectId === projectId).length,
    evalCases: state.evalCases.filter((item) => item.projectId === projectId).length,
    graders: state.graders.filter((item) => item.projectId === projectId).length,
    evalResults: state.evalResults.filter((item) => item.projectId === projectId).length,
    humanLabels: state.humanLabels.filter((item) => item.projectId === projectId).length,
    issues: state.issues.filter((item) => item.projectId === projectId).length,
    reports: state.reports.filter((item) => item.projectId === projectId).length,
    exports: state.exports.filter((item) => item.projectId === projectId).length,
  };
}

function removeProjectRecords(state: LocalState, projectId: string) {
  const issueIds = new Set(state.issues.filter((item) => item.projectId === projectId).map((item) => item.id));
  state.projects = state.projects.filter((item) => item.id !== projectId);
  state.traceImports = state.traceImports.filter((item) =>
    !state.uploadedFiles.some((file) => file.projectId === projectId && file.traceImportId === item.id),
  );
  state.traces = state.traces.filter((item) => item.projectId !== projectId);
  state.uploadedFiles = state.uploadedFiles.filter((item) => item.projectId !== projectId);
  state.processingJobs = state.processingJobs.filter((item) => item.projectId !== projectId);
  state.evalCases = state.evalCases.filter((item) => item.projectId !== projectId);
  state.graders = state.graders.filter((item) => item.projectId !== projectId);
  state.issues = state.issues.filter((item) => item.projectId !== projectId);
  state.issueComments = state.issueComments.filter(
    (item) => item.projectId !== projectId && !issueIds.has(item.issueId),
  );
  state.evalRuns = state.evalRuns.filter((item) => item.projectId !== projectId);
  state.evalResults = state.evalResults.filter((item) => item.projectId !== projectId);
  state.humanLabels = state.humanLabels.filter((item) => item.projectId !== projectId);
  state.graderCalibrationRuns = state.graderCalibrationRuns.filter((item) => item.projectId !== projectId);
  state.graderCalibrationResults = state.graderCalibrationResults.filter((item) => item.projectId !== projectId);
  state.failureClusters = state.failureClusters.filter((item) => item.projectId !== projectId);
  state.promptVersions = state.promptVersions.filter((item) => item.projectId !== projectId);
  state.promptCandidates = state.promptCandidates.filter((item) => item.projectId !== projectId);
  state.routingRules = state.routingRules.filter((item) => item.projectId !== projectId);
  state.cacheRecommendations = state.cacheRecommendations.filter((item) => item.projectId !== projectId);
  state.reports = state.reports.filter((item) => item.projectId !== projectId);
  state.exports = state.exports.filter((item) => item.projectId !== projectId);
}

async function buildAuditReportPdfOrThrow(state: WorkspaceState) {
  if (!state.reports.length) {
    throw new ApiError(409, "Generate an audit report before exporting PDF.", "report_not_ready");
  }
  return buildAuditReportPdf(state);
}

function upsertArtifacts(
  state: LocalState,
  actor: ActorContext,
  project: Project,
  artifacts: AuditArtifacts,
  traces: StoredTrace[],
  provenance?: { traceImportId: string; jobId: string },
) {
  const now = new Date().toISOString();
  const existingCaseIds = new Set(state.evalCases.map((item) => item.id));
  const provenanceMetadata = provenance
    ? { sourceJobId: provenance.jobId, sourceTraceImportId: provenance.traceImportId }
    : {};
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
        passThreshold: item.passThreshold ?? 0.8,
        reviewThreshold: item.reviewThreshold ?? 0.6,
        rubric: item.rubric || item.description,
        failureModes: item.failureModes || [],
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
        ...provenanceMetadata,
      }),
    ),
    ...issues.map((item) =>
      audit(actor, project.organizationId, "issue", item.id, "issue.created", {
        severity: item.severity,
        status: item.status,
        ...provenanceMetadata,
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
    ...(artifacts.failureClusters?.length
      ? artifacts.failureClusters.map((item) => ({
          ...item,
          id: makeId("cluster"),
          organizationId: project.organizationId,
          projectId: project.id,
          createdAt: now,
        }))
      : buildFailureClusters(project, issues, now)),
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
      ...provenanceMetadata,
    }),
    audit(actor, project.organizationId, "report", state.reports[0].id, "report.generated", {
      readinessScore: artifacts.report.readinessScore,
      ...provenanceMetadata,
    }),
  );
  if (artifacts.promptCandidates?.length) {
    state.promptCandidates = [
      ...state.promptCandidates.filter((item) => item.projectId !== project.id),
      ...artifacts.promptCandidates.map((item) => ({
        ...item,
        id: makeId("cand"),
        organizationId: project.organizationId,
        projectId: project.id,
        createdAt: now,
      })),
    ];
  }
  if (artifacts.routingRules?.length) {
    state.routingRules = [
      ...state.routingRules.filter((item) => item.projectId !== project.id),
      ...artifacts.routingRules.map((item) => ({
        ...item,
        id: makeId("route"),
        organizationId: project.organizationId,
        projectId: project.id,
        createdAt: now,
      })),
    ];
  }
  if (artifacts.cacheRecommendations?.length) {
    state.cacheRecommendations = [
      ...state.cacheRecommendations.filter((item) => item.projectId !== project.id),
      ...artifacts.cacheRecommendations.map((item) => ({
        ...item,
        id: makeId("cache"),
        organizationId: project.organizationId,
        projectId: project.id,
        createdAt: now,
      })),
    ];
  }
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

function upsertCalibrationForLabel(state: LocalState, actor: ActorContext, label: StoredHumanLabel) {
  const now = new Date().toISOString();
  const latestResult = state.evalResults
    .filter((item) => item.evalCaseId === label.evalCaseId && item.graderId === label.graderId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const scoreDelta = Math.abs((latestResult?.score ?? label.score) - label.score);
  const severity = latestResult && latestResult.status !== label.status
    ? "high"
    : scoreDelta >= 25
      ? "medium"
      : scoreDelta >= 10
        ? "low"
        : "none";
  const run: GraderCalibrationRun = {
    id: makeId("cal"),
    organizationId: label.organizationId,
    projectId: label.projectId,
    graderId: label.graderId,
    status: severity === "none" ? "completed" : "review",
    agreement: severity === "none" ? 1 : 0,
    totalLabels: 1,
    disagreementCount: severity === "none" ? 0 : 1,
    createdAt: now,
  };
  const result: StoredGraderCalibrationResult = {
    id: makeId("calres"),
    organizationId: label.organizationId,
    projectId: label.projectId,
    calibrationRunId: run.id,
    evalCaseId: label.evalCaseId,
    graderId: label.graderId,
    humanLabelId: label.id,
    evalResultId: latestResult?.id,
    humanScore: label.score,
    judgeScore: latestResult?.score,
    scoreDelta,
    disagreementSeverity: severity,
    reviewStatus: severity === "none" ? "accepted" : "open",
    createdAt: now,
  };
  state.graderCalibrationRuns.unshift(run);
  state.graderCalibrationResults = [
    result,
    ...state.graderCalibrationResults.filter(
      (item) => !(item.evalCaseId === label.evalCaseId && item.graderId === label.graderId),
    ),
  ];
  const labelsForGrader = state.humanLabels.filter((item) => item.graderId === label.graderId);
  const disagreements = state.graderCalibrationResults.filter(
    (item) => item.graderId === label.graderId && item.disagreementSeverity !== "none",
  );
  const agreement = labelsForGrader.length
    ? Math.max(0, Math.round(((labelsForGrader.length - disagreements.length) / labelsForGrader.length) * 100) / 100)
    : 1;
  const grader = state.graders.find((item) => item.id === label.graderId);
  if (grader) {
    grader.agreement = agreement;
    grader.health = agreement >= 0.75 ? "healthy" : "low_agreement";
    grader.lastCalibratedAt = now;
    grader.updatedAt = now;
  }
  state.auditEvents.push(
    audit(actor, label.organizationId, "calibration_result", result.id, "grader.calibrated", {
      evalCaseId: label.evalCaseId,
      graderId: label.graderId,
      disagreementSeverity: severity,
      agreement,
    }),
  );
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
      promptBody: [
        "You are a support assistant for high-friction customer conversations.",
        "Detect frustration, repeated failure, refund, privacy, and safety signals.",
        "Escalate high-risk cases to a human with a concise evidence summary.",
      ].join("\n"),
      sourcePromptVersionId: state.promptVersions.find((item) => item.projectId === project.id)?.id,
      diffSummary: "Adds explicit escalation triggers and evidence handoff format.",
      expectedQualityLift: 12,
      expectedCostDelta: -3,
      expectedLatencyDeltaMs: -80,
      baselinePassRate: 72,
      candidatePassRate: 84,
      regressionRisk: "low",
      explanation: "Adds explicit high-friction detection and human handoff criteria.",
      confidence: 0.78,
      evidenceRefs: [],
      createdAt: now,
    },
    {
      id: makeId("cand"),
      organizationId: project.organizationId,
      projectId: project.id,
      title: "Billing-safe prompt",
      promptBody: [
        "You are a support assistant for billing questions.",
        "Confirm the account context before refund guidance.",
        "State what evidence supports the answer and when to escalate.",
      ].join("\n"),
      sourcePromptVersionId: state.promptVersions.find((item) => item.projectId === project.id)?.id,
      diffSummary: "Tightens billing confirmation and escalation instructions.",
      expectedQualityLift: 8,
      expectedCostDelta: 1,
      expectedLatencyDeltaMs: 120,
      baselinePassRate: 72,
      candidatePassRate: 80,
      regressionRisk: "medium",
      explanation: "Tightens refund and invoice language with confirmation steps.",
      confidence: 0.7,
      evidenceRefs: [],
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
      confidence: index >= 3 ? 0.82 : 0.74,
      evidenceRefs: [],
      calculationBasis: "Derived from intent risk, latest eval pass rate, and static pilot traffic assumptions.",
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
      confidence: 0.76,
      evidenceRefs: [],
      calculationBasis: "Assumes repeated static policy prefix across imported support turns.",
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
      confidence: 0.68,
      evidenceRefs: [],
      calculationBasis: "Assumes stable tool schema ordering improves cache hit rate across support turns.",
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

function normalizeList(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 12);
}

function defaultOrganizationName(actor: ActorContext) {
  return actor.email ? `${actor.email.split("@")[0]}'s workspace` : "EvalOps Workspace";
}
