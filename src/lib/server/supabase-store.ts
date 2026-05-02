/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TraceImport } from "../domain/audit";
import {
  buildCsvExport,
  buildEvalArtifacts,
  parseTraceFile,
} from "../domain/trace-processing";
import { createSupabaseAdminClient } from "./supabase-admin";
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

type DbClient = SupabaseClient;

export async function createSupabaseEvalOpsStore(): Promise<EvalOpsStore> {
  return new SupabaseEvalOpsStore(createSupabaseAdminClient());
}

class SupabaseEvalOpsStore implements EvalOpsStore {
  constructor(private readonly db: DbClient) {}

  async ensureWorkspace(actor: ActorContext) {
    const now = new Date().toISOString();
    const organizationId = actor.organizationId || `org_${actor.userId}`;
    const organizationName = actor.email ? `${actor.email.split("@")[0]}'s workspace` : "EvalOps Workspace";
    const user = {
      id: actor.userId,
      email: actor.email || `${actor.userId}@evalops.local`,
      display_name: actor.email?.split("@")[0] || "EvalOps Reviewer",
      updated_at: now,
    };
    const organization = {
      id: organizationId,
      name: organizationName,
      slug: slugify(organizationName),
      updated_at: now,
    };
    const membership = {
      id: stableId("mem", organizationId, actor.userId),
      organization_id: organizationId,
      user_id: actor.userId,
      role: "owner",
    };

    await checked(this.db.from("profiles").upsert(user, { onConflict: "id" }));
    await checked(this.db.from("organizations").upsert(organization, { onConflict: "id" }));
    await checked(
      this.db.from("organization_memberships").upsert(membership, {
        onConflict: "organization_id,user_id",
      }),
    );
    await this.audit(actor, organizationId, "organization", organizationId, "organization.created", {
      name: organizationName,
    });
    return this.getWorkspaceState(actor);
  }

  async getWorkspaceState(actor: ActorContext, projectId?: string) {
    const organizationId = actor.organizationId || `org_${actor.userId}`;
    const [{ data: user }, { data: organization }, { data: membership }, { data: projects }] =
      await Promise.all([
        checked(this.db.from("profiles").select("*").eq("id", actor.userId).single()),
        checked(this.db.from("organizations").select("*").eq("id", organizationId).single()),
        checked(
          this.db
            .from("organization_memberships")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("user_id", actor.userId)
            .single(),
        ),
        checked(this.db.from("projects").select("*").eq("organization_id", organizationId).order("created_at")),
      ]);

    if (!user || !organization || !membership) {
      throw new Error("Workspace not found for this user.");
    }

    const mappedProjects: Project[] = (projects || []).map(mapProject);
    const activeProject =
      mappedProjects.find((item) => item.id === projectId) ||
      mappedProjects.find((item) => item.status === "active") ||
      mappedProjects[0];

    const scoped = activeProject
      ? await this.loadProjectRecords(organizationId, activeProject.id)
      : emptyProjectRecords();

    return {
      organization: mapOrganization(organization),
      user: mapProfile(user),
      membership: mapMembership(membership),
      projects: mappedProjects,
      activeProject,
      ...scoped,
      auditEvents: await this.listAuditEvents(organizationId),
    };
  }

  async getProjectState(actor: ActorContext, projectId: string) {
    const state = await this.getWorkspaceState(actor, projectId);
    if (!state.activeProject) throw new Error("Project not found for this organization.");
    return state;
  }

  async createProject(actor: ActorContext, input: CreateProjectInput) {
    await this.ensureWorkspace(actor);
    const organizationId = actor.organizationId || `org_${actor.userId}`;
    const now = new Date().toISOString();
    const projectRow = {
      id: id("proj"),
      organization_id: organizationId,
      name: input.name,
      workflow_type: input.workflowType,
      objective: input.objective,
      risk_preferences: input.riskPreferences,
      privacy_mode: input.privacyMode,
      status: "active",
      created_at: now,
      updated_at: now,
    };
    const { data } = await checked(this.db.from("projects").insert(projectRow).select("*").single());
    await this.seedOptimization(actor, organizationId, projectRow.id);
    await this.audit(actor, organizationId, "project", projectRow.id, "project.created", {
      workflowType: input.workflowType,
      privacyMode: input.privacyMode,
    });
    return mapProject(data);
  }

  async createTraceImport(actor: ActorContext, input: CreateTraceImportInput) {
    const state = await this.getProjectState(actor, input.projectId);
    const project = state.activeProject;
    if (!project) throw new Error("Project not found for this organization.");
    const now = new Date().toISOString();
    const traceImportId = id("imp");
    const checksum = createHash("sha256").update(input.text).digest("hex");
    const storagePath = `${project.organizationId}/${project.id}/${traceImportId}/${input.fileName}`;
    const source = sourceFromFileName(input.fileName);
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
    const job: ProcessingJob = {
      id: id("job"),
      organizationId: project.organizationId,
      projectId: project.id,
      traceImportId,
      action: "trace_import",
      status: "running",
      createdAt: now,
      startedAt: now,
    };

    const uploadedFile: UploadedFile = {
      id: id("file"),
      organizationId: project.organizationId,
      projectId: project.id,
      traceImportId,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: Buffer.byteLength(input.text),
      storageBucket: "evalops-trace-uploads",
      storagePath,
      checksum,
      createdAt: now,
    };

    await checked(
      this.db.storage
        .from("evalops-trace-uploads")
        .upload(storagePath, Buffer.from(input.text), {
          contentType: input.contentType,
          upsert: false,
        }),
    );
    await checked(
      this.db.from("trace_imports").insert({
        id: importRecord.id,
        organization_id: project.organizationId,
        project_id: project.id,
        source: importRecord.source,
        name: importRecord.name,
        imported_at: importRecord.importedAt,
        traces: importRecord.traces,
        rows: importRecord.rows,
        status: importRecord.status,
        redaction_status: importRecord.redactionStatus,
        primary_intent: importRecord.primaryIntent,
        risk_level: importRecord.riskLevel,
      }),
    );
    await checked(this.db.from("uploaded_files").insert(toUploadedFileRow(uploadedFile)));
    await checked(this.db.from("processing_jobs").insert(toProcessingJobRow(job)));
    await this.audit(actor, project.organizationId, "uploaded_file", uploadedFile.id, "file.uploaded", {
      storagePath,
      sizeBytes: uploadedFile.sizeBytes,
    });
    await this.audit(actor, project.organizationId, "processing_job", job.id, "file.processing_started", {
      traceImportId,
    });

    try {
      const parsed = parseTraceFile(input);
      const traces: StoredTrace[] = parsed.map((trace) => ({
        ...trace,
        id: id("trace"),
        organizationId: project.organizationId,
        projectId: project.id,
        traceImportId,
      }));
      await checked(this.db.from("traces").insert(traces.map(toTraceRow)));
      const artifacts = buildEvalArtifacts({ projectId: project.id, traces: parsed });
      await this.insertArtifacts(actor, project, artifacts, traces);
      const primaryIntent = mostCommon(traces.map((trace) => trace.intent)) || "General Support";
      importRecord.traces = traces.length;
      importRecord.rows = traces.length;
      importRecord.status = "completed";
      importRecord.redactionStatus = parsed.some((trace) => trace.redactionHits.length) ? "redacted" : "pending";
      importRecord.primaryIntent = primaryIntent;
      importRecord.riskLevel = traces.some((trace) => trace.riskLevel === "high")
        ? "high"
        : traces.some((trace) => trace.riskLevel === "medium")
          ? "medium"
          : "low";
      job.status = "completed";
      job.completedAt = new Date().toISOString();
      await checked(
        this.db
          .from("trace_imports")
          .update({
            traces: importRecord.traces,
            rows: importRecord.rows,
            status: importRecord.status,
            redaction_status: importRecord.redactionStatus,
            primary_intent: importRecord.primaryIntent,
            risk_level: importRecord.riskLevel,
          })
          .eq("id", traceImportId),
      );
      await checked(this.db.from("processing_jobs").update(toProcessingJobRow(job)).eq("id", job.id));
      await this.audit(actor, project.organizationId, "processing_job", job.id, "file.processing_completed", {
        traceCount: traces.length,
        issueCount: artifacts.issues.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown processing error";
      importRecord.status = "failed";
      importRecord.redactionStatus = "failed";
      job.status = "failed";
      job.errorMessage = message;
      job.completedAt = new Date().toISOString();
      await checked(
        this.db
          .from("trace_imports")
          .update({ status: "failed", redaction_status: "failed" })
          .eq("id", traceImportId),
      );
      await checked(this.db.from("processing_jobs").update(toProcessingJobRow(job)).eq("id", job.id));
      await this.audit(
        actor,
        project.organizationId,
        "processing_job",
        job.id,
        "file.processing_failed",
        { error: message },
        "failed",
      );
    }

    return { importRecord, job };
  }

  async updateIssue(actor: ActorContext, input: { issueId: string; status: StoredIssue["status"]; comment?: string }) {
    const organizationId = actor.organizationId || `org_${actor.userId}`;
    const { data: existing } = await checked(
      this.db
        .from("review_issues")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("id", input.issueId)
        .single(),
    );
    if (!existing) throw new Error("Issue not found for this organization.");
    const updatedAt = new Date().toISOString();
    const { data } = await checked(
      this.db
        .from("review_issues")
        .update({
          status: input.status,
          resolved_by: input.status === "resolved" || input.status === "ignored" ? actor.userId : null,
          resolved_at: input.status === "resolved" || input.status === "ignored" ? updatedAt : null,
          updated_at: updatedAt,
        })
        .eq("id", input.issueId)
        .select("*")
        .single(),
    );
    await this.audit(actor, organizationId, "issue", input.issueId, `issue.${input.status}`, {
      status: input.status,
    });
    if (input.comment?.trim()) {
      const comment = {
        id: id("comment"),
        organization_id: organizationId,
        project_id: existing.project_id,
        issue_id: input.issueId,
        actor_user_id: actor.userId,
        body: input.comment.trim(),
      };
      await checked(this.db.from("issue_comments").insert(comment));
      await this.audit(actor, organizationId, "issue_comment", comment.id, "issue.comment.created", {
        issueId: input.issueId,
      });
    }
    return mapIssue(data);
  }

  async updateEvalCase(actor: ActorContext, input: Parameters<EvalOpsStore["updateEvalCase"]>[1]) {
    const organizationId = actor.organizationId || `org_${actor.userId}`;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.userInput !== undefined) patch.user_input = input.userInput;
    if (input.expectedBehavior !== undefined) patch.expected_behavior = input.expectedBehavior;
    if (input.acceptanceCriteria !== undefined) patch.acceptance_criteria = input.acceptanceCriteria;
    if (input.status !== undefined) patch.status = input.status;
    const { data } = await checked(
      this.db
        .from("eval_cases")
        .update(patch)
        .eq("organization_id", organizationId)
        .eq("id", input.caseId)
        .select("*")
        .single(),
    );
    if (!data) throw new Error("Eval case not found for this organization.");
    await this.audit(actor, organizationId, "eval_case", input.caseId, "eval_case.updated", patch);
    return mapEvalCase(data);
  }

  async createExport(actor: ActorContext, projectId: string) {
    const state: WorkspaceState = await this.getProjectState(actor, projectId);
    const project = state.activeProject;
    if (!project) throw new Error("Project not found for this organization.");
    const content = buildCsvExport({ evalCases: state.evalCases, issues: state.issues });
    const exportRecord: ExportRecord = {
      id: id("exp"),
      organizationId: project.organizationId,
      projectId: project.id,
      type: "eval_pack_csv",
      status: "generated",
      storageBucket: "evalops-exports",
      storagePath: `${project.organizationId}/${project.id}/eval-pack-${Date.now()}.csv`,
      fileName: `${slugify(project.name)}-eval-pack.csv`,
      contentType: "text/csv",
      sizeBytes: Buffer.byteLength(content),
      createdAt: new Date().toISOString(),
    };
    await checked(
      this.db.storage
        .from("evalops-exports")
        .upload(exportRecord.storagePath, Buffer.from(content), {
          contentType: "text/csv",
          upsert: false,
        }),
    );
    await checked(this.db.from("exports").insert(toExportRow(exportRecord)));
    await this.audit(actor, project.organizationId, "export", exportRecord.id, "export.generated", {
      caseCount: state.evalCases.length,
      issueCount: state.issues.length,
    });
    return exportRecord;
  }

  async getExport(actor: ActorContext, exportId: string) {
    const organizationId = actor.organizationId || `org_${actor.userId}`;
    const { data } = await checked(
      this.db.from("exports").select("*").eq("organization_id", organizationId).eq("id", exportId).single(),
    );
    if (!data) throw new Error("Export not found for this organization.");
    const record = mapExport(data);
    const downloaded = await checked(this.db.storage.from(record.storageBucket).download(record.storagePath));
    const content = await downloaded.data.text();
    return { record, content };
  }

  async rerunEvaluation(actor: ActorContext, projectId: string) {
    const state: WorkspaceState = await this.getProjectState(actor, projectId);
    const project = state.activeProject;
    if (!project) throw new Error("Project not found for this organization.");
    const failedCases = state.evalCases.filter((item) => item.status === "failed").length;
    const passRate = state.evalCases.length
      ? Math.round(((state.evalCases.length - failedCases) / state.evalCases.length) * 1000) / 10
      : 0;
    const run: EvalRun = {
      id: id("run"),
      organizationId: project.organizationId,
      projectId: project.id,
      status: "completed",
      passRate,
      totalCases: state.evalCases.length,
      failedCases,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    await checked(this.db.from("eval_runs").insert(toEvalRunRow(run)));
    await this.audit(actor, project.organizationId, "eval_run", run.id, "review_rule.executed", {
      totalCases: run.totalCases,
      failedCases,
    });
    return run;
  }

  async promotePromptCandidate(actor: ActorContext, projectId: string, candidateId: string) {
    const state: WorkspaceState = await this.getProjectState(actor, projectId);
    const project = state.activeProject;
    if (!project) throw new Error("Project not found for this organization.");
    const candidate = state.promptCandidates.find((item) => item.id === candidateId);
    if (!candidate) throw new Error("Prompt candidate not found for this project.");
    await checked(
      this.db
        .from("prompt_versions")
        .update({ status: "candidate" })
        .eq("organization_id", project.organizationId)
        .eq("project_id", project.id),
    );
    const version: PromptVersion = {
      id: id("prompt"),
      organizationId: project.organizationId,
      projectId: project.id,
      label: candidate.title,
      prompt: candidate.explanation,
      status: "promoted",
      createdAt: new Date().toISOString(),
    };
    await checked(this.db.from("prompt_versions").insert(toPromptVersionRow(version)));
    await this.audit(actor, project.organizationId, "prompt_version", version.id, "prompt.promoted", {
      candidateId,
    });
    return version;
  }

  private async loadProjectRecords(organizationId: string, projectId: string) {
    const [
      traceImports,
      traces,
      uploadedFiles,
      processingJobs,
      evalCases,
      graders,
      issues,
      issueComments,
      evalRuns,
      failureClusters,
      promptVersions,
      promptCandidates,
      routingRules,
      cacheRecommendations,
      reports,
      exports,
    ] = await Promise.all([
      checked(this.db.from("trace_imports").select("*").eq("organization_id", organizationId).eq("project_id", projectId)),
      checked(this.db.from("traces").select("*").eq("organization_id", organizationId).eq("project_id", projectId)),
      checked(this.db.from("uploaded_files").select("*").eq("organization_id", organizationId).eq("project_id", projectId)),
      checked(this.db.from("processing_jobs").select("*").eq("organization_id", organizationId).eq("project_id", projectId)),
      checked(this.db.from("eval_cases").select("*").eq("organization_id", organizationId).eq("project_id", projectId)),
      checked(this.db.from("graders").select("*").eq("organization_id", organizationId).eq("project_id", projectId)),
      checked(this.db.from("review_issues").select("*").eq("organization_id", organizationId).eq("project_id", projectId)),
      checked(this.db.from("issue_comments").select("*").eq("organization_id", organizationId).eq("project_id", projectId)),
      checked(this.db.from("eval_runs").select("*").eq("organization_id", organizationId).eq("project_id", projectId).order("started_at", { ascending: false })),
      checked(this.db.from("failure_clusters").select("*").eq("organization_id", organizationId).eq("project_id", projectId)),
      checked(this.db.from("prompt_versions").select("*").eq("organization_id", organizationId).eq("project_id", projectId)),
      checked(this.db.from("prompt_candidates").select("*").eq("organization_id", organizationId).eq("project_id", projectId)),
      checked(this.db.from("routing_rules").select("*").eq("organization_id", organizationId).eq("project_id", projectId)),
      checked(this.db.from("cache_recommendations").select("*").eq("organization_id", organizationId).eq("project_id", projectId)),
      checked(this.db.from("reports").select("*").eq("organization_id", organizationId).eq("project_id", projectId).order("created_at", { ascending: false })),
      checked(this.db.from("exports").select("*").eq("organization_id", organizationId).eq("project_id", projectId).order("created_at", { ascending: false })),
    ]);
    return {
      traceImports: (traceImports.data || []).map(mapTraceImport),
      traces: (traces.data || []).map(mapTrace),
      uploadedFiles: (uploadedFiles.data || []).map(mapUploadedFile),
      processingJobs: (processingJobs.data || []).map(mapProcessingJob),
      evalCases: (evalCases.data || []).map(mapEvalCase),
      graders: (graders.data || []).map(mapGrader),
      issues: (issues.data || []).map(mapIssue),
      issueComments: (issueComments.data || []).map(mapIssueComment),
      evalRuns: (evalRuns.data || []).map(mapEvalRun),
      failureClusters: (failureClusters.data || []).map(mapFailureCluster),
      promptVersions: (promptVersions.data || []).map(mapPromptVersion),
      promptCandidates: (promptCandidates.data || []).map(mapPromptCandidate),
      routingRules: (routingRules.data || []).map(mapRoutingRule),
      cacheRecommendations: (cacheRecommendations.data || []).map(mapCacheRecommendation),
      reports: (reports.data || []).map(mapReport),
      exports: (exports.data || []).map(mapExport),
    };
  }

  private async insertArtifacts(
    actor: ActorContext,
    project: Project,
    artifacts: ReturnType<typeof buildEvalArtifacts>,
    traces: StoredTrace[],
  ) {
    const now = new Date().toISOString();
    const evalCases = artifacts.evalCases.map((evalCase, index) => ({
      ...evalCase,
      organizationId: project.organizationId,
      projectId: project.id,
      traceId: traces[index]?.id,
      createdAt: now,
      updatedAt: now,
    }));
    if (evalCases.length) await checked(this.db.from("eval_cases").upsert(evalCases.map(toEvalCaseRow)));
    if (artifacts.graders.length) {
      await checked(
        this.db
          .from("graders")
          .upsert(
            artifacts.graders.map((grader) =>
              toGraderRow({
                ...grader,
                organizationId: project.organizationId,
                projectId: project.id,
                active: true,
                createdAt: now,
                updatedAt: now,
              }),
            ),
          ),
      );
    }
    const issues = artifacts.issues.map((issue) => ({
      ...issue,
      organizationId: project.organizationId,
      projectId: project.id,
      traceId: evalCases.find((evalCase) => evalCase.id === issue.evalCaseId)?.traceId,
      createdAt: now,
      updatedAt: now,
    }));
    if (issues.length) await checked(this.db.from("review_issues").insert(issues.map(toIssueRow)));
    const failedCases = evalCases.filter((item) => item.status === "failed").length;
    const passRate = evalCases.length ? Math.round(((evalCases.length - failedCases) / evalCases.length) * 1000) / 10 : 0;
    const run: EvalRun = {
      id: id("run"),
      organizationId: project.organizationId,
      projectId: project.id,
      status: "completed",
      passRate,
      totalCases: evalCases.length,
      failedCases,
      startedAt: now,
      completedAt: now,
    };
    await checked(this.db.from("eval_runs").insert(toEvalRunRow(run)));
    const clusters = buildFailureClusters(project, issues, now);
    if (clusters.length) await checked(this.db.from("failure_clusters").insert(clusters.map(toFailureClusterRow)));
    const report: Report = {
      id: id("report"),
      organizationId: project.organizationId,
      projectId: project.id,
      title: "Eval Debt Audit Report",
      summary: artifacts.report.summary,
      readinessScore: artifacts.report.readinessScore,
      recommendations: artifacts.report.recommendations,
      createdAt: now,
    };
    await checked(this.db.from("reports").insert(toReportRow(report)));
    await Promise.all([
      ...evalCases.map((item) =>
        this.audit(actor, project.organizationId, "eval_case", item.id, "extraction_result.created", {
          intent: item.intent,
          status: item.status,
        }),
      ),
      ...issues.map((item) =>
        this.audit(actor, project.organizationId, "issue", item.id, "issue.created", {
          severity: item.severity,
          status: item.status,
        }),
      ),
      this.audit(actor, project.organizationId, "eval_run", run.id, "review_rule.executed", {
        totalCases: run.totalCases,
        passRate: run.passRate,
      }),
      this.audit(actor, project.organizationId, "report", report.id, "report.generated", {
        readinessScore: report.readinessScore,
      }),
    ]);
    await this.seedOptimization(actor, project.organizationId, project.id);
  }

  private async seedOptimization(actor: ActorContext, organizationId: string, projectId: string) {
    const { count } = await checked(
      this.db
        .from("prompt_versions")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("project_id", projectId),
    );
    if (count && count > 0) return;
    const now = new Date().toISOString();
    await checked(
      this.db.from("prompt_versions").insert(
        toPromptVersionRow({
          id: id("prompt"),
          organizationId,
          projectId,
          label: "Current production prompt",
          prompt: "Answer from available context, avoid unsupported claims, and escalate high-risk cases.",
          status: "current",
          createdAt: now,
        }),
      ),
    );
    const candidates: PromptCandidate[] = [
      {
        id: id("cand"),
        organizationId,
        projectId,
        title: "Escalation-first support prompt",
        expectedQualityLift: 12,
        expectedCostDelta: -3,
        regressionRisk: "low",
        explanation: "Adds explicit high-friction detection and human handoff criteria.",
        createdAt: now,
      },
      {
        id: id("cand"),
        organizationId,
        projectId,
        title: "Billing-safe prompt",
        expectedQualityLift: 8,
        expectedCostDelta: 1,
        regressionRisk: "medium",
        explanation: "Tightens refund and invoice language with confirmation steps.",
        createdAt: now,
      },
    ];
    await checked(this.db.from("prompt_candidates").insert(candidates.map(toPromptCandidateRow)));
    const routingRules: RoutingRule[] = ["General Support", "Billing", "Refunds", "Escalation", "Privacy"].map((intentName, index) => ({
      id: id("route"),
      organizationId,
      projectId,
      intent: intentName,
      model: index >= 3 ? "gpt-4.1" : "gpt-4.1-mini",
      fallback: index >= 3 ? "Human review" : "gpt-4.1",
      qualityScore: 86 - index * 2,
      estimatedCost: index >= 3 ? 0.028 : 0.012,
      estimatedLatencyMs: index >= 3 ? 2100 : 1200,
      trafficShare: Math.max(5, 35 - index * 6),
      createdAt: now,
    }));
    await checked(this.db.from("routing_rules").insert(routingRules.map(toRoutingRuleRow)));
    const cacheRecommendations: CacheRecommendation[] = [
      {
        id: id("cache"),
        organizationId,
        projectId,
        title: "Move static policy guidance before dynamic user context",
        detail: "This increases cacheable prefix length without changing model behavior.",
        impact: "high",
        estimatedMonthlySavings: 680,
        createdAt: now,
      },
      {
        id: id("cache"),
        organizationId,
        projectId,
        title: "Standardize tool schema ordering",
        detail: "Stable JSON key ordering improves prompt cache hit rate across support turns.",
        impact: "medium",
        estimatedMonthlySavings: 240,
        createdAt: now,
      },
    ];
    await checked(this.db.from("cache_recommendations").insert(cacheRecommendations.map(toCacheRecommendationRow)));
    await this.audit(actor, organizationId, "project", projectId, "optimizer.initialized", {
      candidateCount: candidates.length,
    });
  }

  private async listAuditEvents(organizationId: string): Promise<AuditEvent[]> {
    const { data } = await checked(
      this.db
        .from("audit_events")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100),
    );
    return (data || []).map(mapAuditEvent);
  }

  private async audit(
    actor: ActorContext,
    organizationId: string,
    entityType: string,
    entityId: string,
    action: string,
    metadata: Record<string, unknown>,
    status: AuditEvent["status"] = "succeeded",
  ) {
    await checked(
      this.db.from("audit_events").insert({
        id: id("evt"),
        organization_id: organizationId,
        actor_user_id: actor.userId,
        entity_type: entityType,
        entity_id: entityId,
        action,
        status,
        metadata,
      }),
    );
  }
}

async function checked(result: any): Promise<any> {
  const resolved = await result;
  if (resolved.error) throw new Error(resolved.error.message);
  return resolved;
}

function emptyProjectRecords(): Omit<WorkspaceState, "organization" | "user" | "membership" | "projects" | "activeProject" | "auditEvents"> {
  return {
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
  };
}

function id(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function stableId(prefix: string, ...parts: string[]) {
  return `${prefix}_${createHash("sha1").update(parts.join(":")).digest("hex").slice(0, 16)}`;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function sourceFromFileName(fileName: string): TraceImport["source"] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return "CSV";
  if (lower.endsWith(".json")) return "JSON";
  if (lower.endsWith(".ndjson")) return "NDJSON";
  return "TXT";
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function buildFailureClusters(project: Project, issues: StoredIssue[], now: string): FailureCluster[] {
  const grouped = new Map<string, StoredIssue[]>();
  issues.forEach((issue) => grouped.set(issue.title, [...(grouped.get(issue.title) || []), issue]));
  return Array.from(grouped.entries()).map(([label, items]) => ({
    id: id("cluster"),
    organizationId: project.organizationId,
    projectId: project.id,
    label,
    severity: items.some((item) => item.severity === "high") ? "high" : "medium",
    issueCount: items.length,
    percent: issues.length ? Math.round((items.length / issues.length) * 1000) / 10 : 0,
    createdAt: now,
  }));
}

const mapProfile = (row: any): UserProfile => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  createdAt: row.created_at,
});
const mapOrganization = (row: any): Organization => ({ id: row.id, name: row.name, slug: row.slug, createdAt: row.created_at });
const mapMembership = (row: any): OrganizationMembership => ({
  id: row.id,
  organizationId: row.organization_id,
  userId: row.user_id,
  role: row.role,
  createdAt: row.created_at,
});
const mapProject = (row: any): Project => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
  workflowType: row.workflow_type,
  objective: row.objective,
  riskPreferences: row.risk_preferences || [],
  privacyMode: row.privacy_mode,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const mapTraceImport = (row: any): TraceImport => ({
  id: row.id,
  source: row.source,
  name: row.name,
  importedAt: row.imported_at,
  traces: row.traces,
  rows: row.rows,
  status: row.status,
  redactionStatus: row.redaction_status,
  primaryIntent: row.primary_intent,
  riskLevel: row.risk_level,
});
const mapTrace = (row: any): StoredTrace => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  traceImportId: row.trace_import_id,
  externalId: row.external_id,
  sourceType: row.source_type,
  input: row.input,
  output: row.output,
  redactedInput: row.redacted_input,
  redactedOutput: row.redacted_output,
  redactionHits: row.redaction_hits || [],
  intent: row.intent,
  riskLevel: row.risk_level,
  occurredAt: row.occurred_at,
  metadata: row.metadata || {},
});
const mapUploadedFile = (row: any): UploadedFile => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  traceImportId: row.trace_import_id,
  fileName: row.file_name,
  contentType: row.content_type,
  sizeBytes: Number(row.size_bytes),
  storageBucket: row.storage_bucket,
  storagePath: row.storage_path,
  checksum: row.checksum,
  createdAt: row.created_at,
});
const mapProcessingJob = (row: any): ProcessingJob => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  traceImportId: row.trace_import_id,
  action: row.action,
  status: row.status,
  errorMessage: row.error_message || undefined,
  startedAt: row.started_at || undefined,
  completedAt: row.completed_at || undefined,
  createdAt: row.created_at,
});
const mapEvalCase = (row: any): StoredEvalCase => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  traceId: row.trace_id || undefined,
  name: row.name,
  set: row.eval_set,
  intent: row.intent,
  source: row.source,
  risk: row.risk,
  grader: row.grader,
  lastResult: Number(row.last_result),
  status: row.status,
  userInput: row.user_input,
  expectedBehavior: row.expected_behavior,
  acceptanceCriteria: row.acceptance_criteria || [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const mapGrader = (row: any): StoredGrader => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  name: row.name,
  type: row.type,
  description: row.description,
  health: row.health,
  agreement: Number(row.agreement),
  model: row.model || undefined,
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const mapIssue = (row: any): StoredIssue => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  evalCaseId: row.eval_case_id,
  traceId: row.trace_id || undefined,
  title: row.title,
  severity: row.severity,
  status: row.status,
  description: row.description,
  resolvedBy: row.resolved_by || undefined,
  resolvedAt: row.resolved_at || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const mapIssueComment = (row: any): IssueComment => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  issueId: row.issue_id,
  actorUserId: row.actor_user_id,
  body: row.body,
  createdAt: row.created_at,
});
const mapEvalRun = (row: any): EvalRun => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  status: row.status,
  passRate: Number(row.pass_rate),
  totalCases: row.total_cases,
  failedCases: row.failed_cases,
  startedAt: row.started_at,
  completedAt: row.completed_at || undefined,
});
const mapFailureCluster = (row: any): FailureCluster => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  label: row.label,
  severity: row.severity,
  issueCount: row.issue_count,
  percent: Number(row.percent),
  createdAt: row.created_at,
});
const mapPromptVersion = (row: any): PromptVersion => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  label: row.label,
  prompt: row.prompt,
  status: row.status,
  createdAt: row.created_at,
});
const mapPromptCandidate = (row: any): PromptCandidate => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  title: row.title,
  expectedQualityLift: Number(row.expected_quality_lift),
  expectedCostDelta: Number(row.expected_cost_delta),
  regressionRisk: row.regression_risk,
  explanation: row.explanation,
  createdAt: row.created_at,
});
const mapRoutingRule = (row: any): RoutingRule => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  intent: row.intent,
  model: row.model,
  fallback: row.fallback,
  qualityScore: Number(row.quality_score),
  estimatedCost: Number(row.estimated_cost),
  estimatedLatencyMs: row.estimated_latency_ms,
  trafficShare: Number(row.traffic_share),
  createdAt: row.created_at,
});
const mapCacheRecommendation = (row: any): CacheRecommendation => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  title: row.title,
  detail: row.detail,
  impact: row.impact,
  estimatedMonthlySavings: Number(row.estimated_monthly_savings),
  createdAt: row.created_at,
});
const mapReport = (row: any): Report => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  title: row.title,
  summary: row.summary,
  readinessScore: Number(row.readiness_score),
  recommendations: row.recommendations || [],
  createdAt: row.created_at,
});
const mapExport = (row: any): ExportRecord => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  type: row.type,
  status: row.status,
  storageBucket: row.storage_bucket,
  storagePath: row.storage_path,
  fileName: row.file_name,
  contentType: row.content_type,
  sizeBytes: Number(row.size_bytes),
  createdAt: row.created_at,
});
const mapAuditEvent = (row: any): AuditEvent => ({
  id: row.id,
  organizationId: row.organization_id,
  actorUserId: row.actor_user_id,
  entityType: row.entity_type,
  entityId: row.entity_id,
  action: row.action,
  status: row.status,
  metadata: row.metadata || {},
  correlationId: row.correlation_id || undefined,
  createdAt: row.created_at,
});

const toUploadedFileRow = (item: UploadedFile) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  trace_import_id: item.traceImportId,
  file_name: item.fileName,
  content_type: item.contentType,
  size_bytes: item.sizeBytes,
  storage_bucket: item.storageBucket,
  storage_path: item.storagePath,
  checksum: item.checksum,
  created_at: item.createdAt,
});
const toProcessingJobRow = (item: ProcessingJob) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  trace_import_id: item.traceImportId,
  action: item.action,
  status: item.status,
  error_message: item.errorMessage || null,
  started_at: item.startedAt || null,
  completed_at: item.completedAt || null,
  created_at: item.createdAt,
});
const toTraceRow = (item: StoredTrace) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  trace_import_id: item.traceImportId,
  external_id: item.externalId,
  source_type: item.sourceType,
  input: item.input,
  output: item.output,
  redacted_input: item.redactedInput,
  redacted_output: item.redactedOutput,
  redaction_hits: item.redactionHits,
  intent: item.intent,
  risk_level: item.riskLevel,
  occurred_at: item.occurredAt,
  metadata: item.metadata,
});
const toEvalCaseRow = (item: StoredEvalCase) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  trace_id: item.traceId || null,
  name: item.name,
  eval_set: item.set,
  intent: item.intent,
  source: item.source,
  risk: item.risk,
  grader: item.grader,
  last_result: item.lastResult,
  status: item.status,
  user_input: item.userInput,
  expected_behavior: item.expectedBehavior,
  acceptance_criteria: item.acceptanceCriteria,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
});
const toGraderRow = (item: StoredGrader) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  name: item.name,
  type: item.type,
  description: item.description,
  health: item.health,
  agreement: item.agreement,
  model: item.model || null,
  active: item.active,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
});
const toIssueRow = (item: StoredIssue) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  eval_case_id: item.evalCaseId,
  trace_id: item.traceId || null,
  title: item.title,
  severity: item.severity,
  status: item.status,
  description: item.description,
  resolved_by: item.resolvedBy || null,
  resolved_at: item.resolvedAt || null,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
});
const toEvalRunRow = (item: EvalRun) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  status: item.status,
  pass_rate: item.passRate,
  total_cases: item.totalCases,
  failed_cases: item.failedCases,
  started_at: item.startedAt,
  completed_at: item.completedAt || null,
});
const toFailureClusterRow = (item: FailureCluster) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  label: item.label,
  severity: item.severity,
  issue_count: item.issueCount,
  percent: item.percent,
  created_at: item.createdAt,
});
const toPromptVersionRow = (item: PromptVersion) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  label: item.label,
  prompt: item.prompt,
  status: item.status,
  created_at: item.createdAt,
});
const toPromptCandidateRow = (item: PromptCandidate) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  title: item.title,
  expected_quality_lift: item.expectedQualityLift,
  expected_cost_delta: item.expectedCostDelta,
  regression_risk: item.regressionRisk,
  explanation: item.explanation,
  created_at: item.createdAt,
});
const toRoutingRuleRow = (item: RoutingRule) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  intent: item.intent,
  model: item.model,
  fallback: item.fallback,
  quality_score: item.qualityScore,
  estimated_cost: item.estimatedCost,
  estimated_latency_ms: item.estimatedLatencyMs,
  traffic_share: item.trafficShare,
  created_at: item.createdAt,
});
const toCacheRecommendationRow = (item: CacheRecommendation) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  title: item.title,
  detail: item.detail,
  impact: item.impact,
  estimated_monthly_savings: item.estimatedMonthlySavings,
  created_at: item.createdAt,
});
const toReportRow = (item: Report) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  title: item.title,
  summary: item.summary,
  readiness_score: item.readinessScore,
  recommendations: item.recommendations,
  created_at: item.createdAt,
});
const toExportRow = (item: ExportRecord) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  type: item.type,
  status: item.status,
  storage_bucket: item.storageBucket,
  storage_path: item.storagePath,
  file_name: item.fileName,
  content_type: item.contentType,
  size_bytes: item.sizeBytes,
  created_at: item.createdAt,
});
