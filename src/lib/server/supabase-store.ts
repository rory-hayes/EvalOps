/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
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
import { canUseBillingFeatures } from "./commercial/plans";
import { canConsumeQuota, getCurrentMonthlyPeriod, summarizeUsage } from "./commercial/usage";
import { canInviteRole, createInviteTokenHash, isInviteExpired, verifyInviteToken } from "./commercial/invites";
import { canPerformPermission, type RolePermission } from "./permissions";
import { createSupabaseAdminClient } from "./supabase-admin";
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
  BillingOverview,
  CacheRecommendation,
  CreateExportInput,
  CreateOrganizationInvitationInput,
  CreateProjectInput,
  CreateSupportRequestInput,
  CreateTraceImportInput,
  DataOperationReceipt,
  DeleteProjectInput,
  EvalOpsStore,
  EvalRun,
  ExportRecord,
  FailureCluster,
  GraderCalibrationRun,
  StoredGraderCalibrationResult,
  IssueComment,
  Organization,
  OrganizationBilling,
  OrganizationInvitation,
  OrganizationMembership,
  ProcessingJob,
  ProcessFullProjectExportInput,
  ProcessProjectDeletionInput,
  ProcessTraceImportInput,
  Project,
  PromptCandidate,
  PromptVersion,
  PurgeRawProjectDataInput,
  RecordUsageInput,
  Report,
  RoutingRule,
  StoredEvalCase,
  StoredEvalResult,
  StoredGrader,
  StoredHumanLabel,
  StoredIssue,
  StoredTrace,
  StoredUsageEvent,
  SupportRequest,
  UpdateGraderInput,
  UpdateOrganizationBillingInput,
  UpdateOrganizationMemberInput,
  UpdateProjectSettingsInput,
  UpsertHumanLabelInput,
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

  async ensureWorkspace(actor: ActorContext): Promise<WorkspaceState> {
    const now = new Date().toISOString();
    const user = {
      id: actor.userId,
      email: actor.email || `${actor.userId}@evalops.local`,
      display_name: actor.email?.split("@")[0] || "EvalOps Reviewer",
      updated_at: now,
    };
    await checked(this.db.from("profiles").upsert(user, { onConflict: "id" }));

    const { data: existingMemberships } = await checked(
      this.db
        .from("organization_memberships")
        .select("*, organizations(*)")
        .eq("user_id", actor.userId)
        .order("created_at"),
    );
    const selectedMembership = actor.organizationId
      ? (existingMemberships || []).find((item: any) => item.organization_id === actor.organizationId)
      : (existingMemberships || [])[0];

    if (selectedMembership?.organizations) {
      await this.ensureBillingRow(selectedMembership.organization_id);
      return this.getWorkspaceState({ ...actor, organizationId: selectedMembership.organization_id });
    }

    if (actor.organizationId) {
      throw new ApiError(403, "You are not a member of that organization.", "organization_forbidden");
    }

    const organizationId = `org_${actor.userId}`;
    const organizationName = actor.email ? `${actor.email.split("@")[0]}'s workspace` : "EvalOps Workspace";
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

    await checked(this.db.from("organizations").upsert(organization, { onConflict: "id" }));
    await checked(
      this.db.from("organization_memberships").upsert(membership, {
        onConflict: "organization_id,user_id",
      }),
    );
    await this.ensureBillingRow(organizationId);
    await this.insertUsage({
      organizationId,
      metric: "seats",
      quantity: 1,
      source: "workspace.created",
      sourceId: membership.id,
      metadata: { role: "owner" },
      createdAt: now,
    });
    await this.audit(actor, organizationId, "organization", organizationId, "organization.created", {
      name: organizationName,
    });
    return this.getWorkspaceState({ ...actor, organizationId });
  }

  async getWorkspaceState(actor: ActorContext, projectId?: string): Promise<WorkspaceState> {
    const membershipContext: { organizationId: string; membership: OrganizationMembership } = await this.resolveMembership(actor);
    const organizationId: string = membershipContext.organizationId;
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
      organization: mapOrganization(organization as any),
      user: mapProfile(user),
      membership: mapMembership(membership),
      billing: await this.buildBillingOverview(organizationId),
      members: await this.listOrganizationMembers(organizationId),
      invitations: await this.listOrganizationInvitations(organizationId),
      supportRequests: await this.listSupportRequests(organizationId),
      projects: mappedProjects,
      activeProject,
      ...scoped,
      dataOperationReceipts: await this.listDataOperationReceipts(organizationId),
      auditEvents: await this.listAuditEvents(organizationId),
    };
  }

  async getProjectState(actor: ActorContext, projectId: string) {
    const state = await this.getWorkspaceState(actor, projectId);
    if (!state.activeProject) throw new Error("Project not found for this organization.");
    return state;
  }

  async listOrganizations(actor: ActorContext) {
    await checked(
      this.db.from("profiles").upsert({
        id: actor.userId,
        email: actor.email || `${actor.userId}@evalops.local`,
        display_name: actor.email?.split("@")[0] || "EvalOps Reviewer",
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" }),
    );
    const { data } = await checked(
      this.db
        .from("organization_memberships")
        .select("*, organizations(*)")
        .eq("user_id", actor.userId)
        .order("created_at"),
    );
    return (data || [])
      .filter((item: any) => item.organizations)
      .map((item: any) => ({
        organization: mapOrganization(item.organizations),
        membership: mapMembership(item),
      }));
  }

  async getBillingOverview(actor: ActorContext) {
    const context = await this.resolveMembership(actor);
    return this.buildBillingOverview(context.organizationId);
  }

  async updateOrganizationBilling(actor: ActorContext, input: UpdateOrganizationBillingInput) {
    const organizationId = input.organizationId || (await this.resolveMembership(actor)).organizationId;
    await this.ensureBillingRow(organizationId);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.planId !== undefined) patch.plan_id = input.planId;
    if (input.status !== undefined) patch.status = input.status;
    if (input.stripeCustomerId !== undefined) patch.stripe_customer_id = input.stripeCustomerId;
    if (input.stripeSubscriptionId !== undefined) patch.stripe_subscription_id = input.stripeSubscriptionId;
    if (input.stripePriceId !== undefined) patch.stripe_price_id = input.stripePriceId;
    if (input.stripeCurrentPeriodStart !== undefined) patch.stripe_current_period_start = input.stripeCurrentPeriodStart;
    if (input.stripeCurrentPeriodEnd !== undefined) patch.stripe_current_period_end = input.stripeCurrentPeriodEnd;
    if (input.trialEndsAt !== undefined) patch.trial_ends_at = input.trialEndsAt;
    if (input.cancelAtPeriodEnd !== undefined) patch.cancel_at_period_end = input.cancelAtPeriodEnd;
    if (input.metadata !== undefined) patch.metadata = input.metadata;
    const { data } = await checked(
      this.db.from("organization_billing").update(patch).eq("organization_id", organizationId).select("*").single(),
    );
    return mapOrganizationBilling(data);
  }

  async recordUsage(actor: ActorContext, input: RecordUsageInput) {
    const context = await this.resolveMembership(actor);
    return this.insertUsage({
      organizationId: input.organizationId || context.organizationId,
      projectId: input.projectId,
      metric: input.metric,
      quantity: input.quantity || 1,
      source: input.source,
      sourceId: input.sourceId,
      metadata: input.metadata || {},
      createdAt: new Date().toISOString(),
    });
  }

  async hasProcessedStripeEvent(eventId: string) {
    const { data } = await checked(this.db.from("stripe_events").select("id").eq("id", eventId).maybeSingle());
    return Boolean(data);
  }

  async recordStripeEvent(input: { id: string; type: string; livemode: boolean; payload: Record<string, unknown> }) {
    await checked(this.db.from("stripe_events").upsert({
      id: input.id,
      type: input.type,
      livemode: input.livemode,
      payload: input.payload,
      processed_at: new Date().toISOString(),
    }, { onConflict: "id" }));
  }

  async findOrganizationBillingByStripeCustomer(stripeCustomerId: string) {
    const { data } = await checked(
      this.db.from("organization_billing").select("*").eq("stripe_customer_id", stripeCustomerId).maybeSingle(),
    );
    return data ? mapOrganizationBilling(data) : undefined;
  }

  async createOrganizationInvitation(actor: ActorContext, input: CreateOrganizationInvitationInput) {
    const state = await this.ensureWorkspace(actor);
    requirePermission(state.membership, "manageMembers");
    if (!canInviteRole({ inviterRole: state.membership.role, inviteeRole: input.role })) {
      throw new ApiError(403, "You cannot invite that role.", "forbidden_role");
    }
    await this.assertQuota(state.organization.id, "seats", 1);
    const now = new Date();
    const token = randomBytes(24).toString("base64url");
    const row = {
      id: id("invite"),
      organization_id: state.organization.id,
      email: input.email.toLowerCase(),
      role: input.role,
      token_hash: createInviteTokenHash(token),
      status: "pending",
      invited_by: actor.userId,
      expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const { data } = await checked(this.db.from("organization_invitations").insert(row).select("*").single());
    return { invitation: mapInvitation(data), token };
  }

  async acceptOrganizationInvitation(actor: ActorContext, token: string) {
    await checked(
      this.db.from("profiles").upsert({
        id: actor.userId,
        email: actor.email || `${actor.userId}@evalops.local`,
        display_name: actor.email?.split("@")[0] || "EvalOps Reviewer",
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" }),
    );
    const { data: pending } = await checked(
      this.db.from("organization_invitations").select("*").eq("status", "pending"),
    );
    const invitation = (pending || []).find((item: any) => verifyInviteToken(token, item.token_hash));
    if (!invitation) throw new ApiError(404, "Invitation not found or already used.", "invitation_not_found");
    const now = new Date().toISOString();
    if (isInviteExpired(invitation.expires_at)) {
      await checked(this.db.from("organization_invitations").update({ status: "expired", updated_at: now }).eq("id", invitation.id));
      throw new ApiError(410, "Invitation has expired.", "invitation_expired");
    }
    const membership = {
      id: stableId("mem", invitation.organization_id, actor.userId),
      organization_id: invitation.organization_id,
      user_id: actor.userId,
      role: invitation.role,
      created_at: now,
    };
    const { data } = await checked(
      this.db.from("organization_memberships").upsert(membership, { onConflict: "organization_id,user_id" }).select("*").single(),
    );
    await checked(
      this.db.from("organization_invitations").update({
        status: "accepted",
        accepted_by: actor.userId,
        accepted_at: now,
        updated_at: now,
      }).eq("id", invitation.id),
    );
    await this.insertUsage({
      organizationId: invitation.organization_id,
      metric: "seats",
      quantity: 1,
      source: "invitation.accepted",
      sourceId: invitation.id,
      metadata: { role: invitation.role },
      createdAt: now,
    });
    return mapMembership(data);
  }

  async updateOrganizationMember(actor: ActorContext, input: UpdateOrganizationMemberInput) {
    const state = await this.ensureWorkspace(actor);
    requirePermission(state.membership, "manageMembers");
    const member = state.members.find((item) => item.id === input.membershipId);
    if (!member) throw new ApiError(404, "Member not found.", "member_not_found");
    if (member.role === "owner" && input.role !== "owner") {
      await this.assertCanChangeOwner(state.organization.id, member.id);
    }
    const { data } = await checked(
      this.db.from("organization_memberships").update({ role: input.role }).eq("id", input.membershipId).eq("organization_id", state.organization.id).select("*").single(),
    );
    return mapMembership(data);
  }

  async removeOrganizationMember(actor: ActorContext, membershipId: string) {
    const state = await this.ensureWorkspace(actor);
    requirePermission(state.membership, "manageMembers");
    const member = state.members.find((item) => item.id === membershipId);
    if (!member) throw new ApiError(404, "Member not found.", "member_not_found");
    if (member.role === "owner") await this.assertCanChangeOwner(state.organization.id, member.id);
    await checked(this.db.from("organization_memberships").delete().eq("id", membershipId).eq("organization_id", state.organization.id));
  }

  async createSupportRequest(actor: ActorContext, input: CreateSupportRequestInput) {
    const state = await this.ensureWorkspace(actor);
    const now = new Date().toISOString();
    const row = {
      id: id("support"),
      organization_id: state.organization.id,
      project_id: input.projectId || null,
      actor_user_id: actor.userId,
      request_type: input.requestType,
      priority: input.priority || "normal",
      subject: input.subject,
      message: input.message,
      status: "open",
      metadata: {},
      created_at: now,
      updated_at: now,
    };
    const { data } = await checked(this.db.from("support_requests").insert(row).select("*").single());
    return mapSupportRequest(data);
  }

  async createProject(actor: ActorContext, input: CreateProjectInput) {
    const workspace = await this.ensureWorkspace(actor);
    this.assertPaidAction(workspace, "manageProjects");
    await this.assertQuota(workspace.organization.id, "projects", 1);
    const organizationId = workspace.organization.id;
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
    await this.insertUsage({
      organizationId,
      projectId: projectRow.id,
      metric: "projects",
      quantity: 1,
      source: "project.created",
      sourceId: projectRow.id,
      metadata: { workflowType: input.workflowType },
      createdAt: now,
    });
    await this.seedOptimization(actor, organizationId, projectRow.id);
    await this.audit(actor, organizationId, "project", projectRow.id, "project.created", {
      workflowType: input.workflowType,
      privacyMode: input.privacyMode,
    });
    return mapProject(data);
  }

  async updateProjectSettings(actor: ActorContext, projectId: string, input: UpdateProjectSettingsInput) {
    const state: WorkspaceState = await this.getProjectState(actor, projectId);
    this.assertPaidAction(state, "manageSettings");
    const project = state.activeProject;
    if (!project) throw new Error("Project not found for this organization.");
    const shouldPurgeRaw =
      input.privacyMode === "derived_only" &&
      (state.uploadedFiles.some((item) => !item.rawPurgedAt) ||
        state.traces.some((item) => !item.rawPurgedAt));
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.privacyMode !== undefined) patch.privacy_mode = input.privacyMode;
    if (input.riskPreferences !== undefined) patch.risk_preferences = normalizeList(input.riskPreferences);
    const { data } = await checked(
      this.db
        .from("projects")
        .update(patch)
        .eq("organization_id", project.organizationId)
        .eq("id", project.id)
        .select("*")
        .single(),
    );
    await this.audit(actor, project.organizationId, "project", project.id, "project.settings.updated", {
      privacyMode: data.privacy_mode,
      riskPreferenceCount: (data.risk_preferences || []).length,
    });
    if (shouldPurgeRaw) {
      await this.purgeRawProjectData(actor, {
        projectId: project.id,
        reason: "derived_only",
      });
    }
    return mapProject(data);
  }

  async createTraceImport(actor: ActorContext, input: CreateTraceImportInput) {
    const state: WorkspaceState = await this.getProjectState(actor, input.projectId);
    this.assertPaidAction(state, "uploadTraces");
    await this.assertQuota(state.organization.id, "uploads", 1);
    const project = state.activeProject;
    if (!project) throw new Error("Project not found for this organization.");
    const now = new Date().toISOString();
    const traceImportId = id("imp");
    const checksum = createHash("sha256").update(input.text).digest("hex");
    const duplicate = state.uploadedFiles.find((item) => item.checksum === checksum);
    if (duplicate) {
      throw new ApiError(
        409,
        `This file has already been imported for this project as ${duplicate.fileName}.`,
        "duplicate_upload",
      );
    }
    const storagePath = `${project.organizationId}/${project.id}/${traceImportId}/${input.fileName}`;
    const source = sourceFromFileName(input.fileName, input.contentType);
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
    const job: ProcessingJob = {
      id: id("job"),
      organizationId: project.organizationId,
      projectId: project.id,
      traceImportId,
      action: "trace_import",
      status: "queued",
      metadata: { fileName: input.fileName, checksum },
      createdAt: now,
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
      rawRetentionExpiresAt,
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
        raw_retention_expires_at: importRecord.rawRetentionExpiresAt || null,
      }),
    );
    await checked(this.db.from("uploaded_files").insert(toUploadedFileRow(uploadedFile)));
    await checked(this.db.from("processing_jobs").insert(toProcessingJobRow(job)));
    await this.insertUsage({
      organizationId: project.organizationId,
      projectId: project.id,
      metric: "uploads",
      quantity: 1,
      source: "trace_import.created",
      sourceId: traceImportId,
      metadata: { fileName: input.fileName },
      createdAt: now,
    });
    await this.audit(actor, project.organizationId, "uploaded_file", uploadedFile.id, "file.uploaded", {
      storagePath,
      sizeBytes: uploadedFile.sizeBytes,
    });
    await this.audit(actor, project.organizationId, "processing_job", job.id, "file.processing_queued", {
      traceImportId,
    });

    return { importRecord, job };
  }

  async processTraceImport(actor: ActorContext, input: ProcessTraceImportInput) {
    const state: WorkspaceState = await this.getProjectState(actor, input.projectId);
    this.assertPaidAction(state, "runGenerations");
    await this.assertQuota(state.organization.id, "openai_generations", 1);
    const project = state.activeProject;
    if (!project) throw new Error("Project not found for this organization.");
    const importRecord = state.traceImports.find((item) => item.id === input.traceImportId);
    if (!importRecord) throw new Error("Trace import not found for this organization.");
    const uploadedFile = state.uploadedFiles.find((item) => item.traceImportId === importRecord.id);
    if (!uploadedFile) throw new Error("Uploaded file not found for this trace import.");
    const job =
      state.processingJobs.find((item) => item.id === input.jobId) ||
      state.processingJobs.find((item) => item.traceImportId === importRecord.id);
    if (!job) throw new Error("Processing job not found for this trace import.");

    if (importRecord.status === "completed" && job.status === "completed") {
      return { importRecord, job };
    }

    job.status = "running";
    job.startedAt = job.startedAt || new Date().toISOString();
    job.errorMessage = undefined;
    job.metadata = { ...(job.metadata || {}), sourceTraceImportId: importRecord.id };
    await checked(
      this.db
        .from("processing_jobs")
        .update(toProcessingJobRow(job))
        .eq("organization_id", project.organizationId)
        .eq("id", job.id),
    );
    await this.audit(actor, project.organizationId, "processing_job", job.id, "file.processing_started", {
      traceImportId: importRecord.id,
    });

    try {
      const downloaded = await checked(
        this.db.storage.from(uploadedFile.storageBucket).download(uploadedFile.storagePath),
      );
      const text = await downloaded.data.text();
      const parsed = parseTraceFile({
        fileName: uploadedFile.fileName,
        contentType: uploadedFile.contentType,
        text,
      });
      const traces: StoredTrace[] = parsed.map((trace) => ({
        ...trace,
        id: id("trace"),
        organizationId: project.organizationId,
        projectId: project.id,
        traceImportId: importRecord.id,
        rawRetentionExpiresAt: importRecord.rawRetentionExpiresAt || uploadedFile.rawRetentionExpiresAt,
      }));
      await checked(
        this.db
          .from("traces")
          .delete()
          .eq("organization_id", project.organizationId)
          .eq("project_id", project.id)
          .eq("trace_import_id", importRecord.id),
      );
      if (traces.length) await checked(this.db.from("traces").insert(traces.map(toTraceRow)));
      const artifacts = await generateAuditArtifacts({
        project,
        traces: traces as Array<NormalizedTrace & { id: string }>,
      });
      await this.insertUsage({
        organizationId: project.organizationId,
        projectId: project.id,
        metric: "openai_generations",
        quantity: 1,
        source: "trace_import.processed",
        sourceId: importRecord.id,
        metadata: {
          provider: artifacts.generationMetadata?.provider,
          model: artifacts.generationMetadata?.model,
        },
        createdAt: new Date().toISOString(),
      });
      await this.insertArtifacts(actor, project, artifacts, traces, {
        traceImportId: importRecord.id,
        jobId: job.id,
      });
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
      job.metadata = { ...(job.metadata || {}), generation: artifacts.generationMetadata };
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
            raw_retention_expires_at: importRecord.rawRetentionExpiresAt || null,
          })
          .eq("organization_id", project.organizationId)
          .eq("id", importRecord.id),
      );
      await checked(
        this.db
          .from("processing_jobs")
          .update(toProcessingJobRow(job))
          .eq("organization_id", project.organizationId)
          .eq("id", job.id),
      );
      await this.audit(actor, project.organizationId, "processing_job", job.id, "file.processing_completed", {
        traceCount: traces.length,
        issueCount: artifacts.issues.length,
        generation: artifacts.generationMetadata,
      });
      if (project.privacyMode === "derived_only") {
        await this.purgeRawProjectData(actor, {
          projectId: project.id,
          traceImportId: importRecord.id,
          reason: "derived_only",
          now: job.completedAt,
        });
      }
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
          .eq("organization_id", project.organizationId)
          .eq("id", importRecord.id),
      );
      await checked(
        this.db
          .from("processing_jobs")
          .update(toProcessingJobRow(job))
          .eq("organization_id", project.organizationId)
          .eq("id", job.id),
      );
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
    const context = await this.resolveMembership(actor);
    requirePermission(context.membership, "reviewEvals");
    const organizationId = context.organizationId;
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

  async updateGrader(actor: ActorContext, input: UpdateGraderInput) {
    const context = await this.resolveMembership(actor);
    const state = await this.getWorkspaceState({ ...actor, organizationId: context.organizationId });
    this.assertPaidAction(state, "runGenerations");
    const organizationId = context.organizationId;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.description !== undefined) patch.description = input.description.trim();
    if (input.active !== undefined) patch.active = input.active;
    if (input.model !== undefined) patch.model = input.model?.trim() || null;
    if (input.passThreshold !== undefined) patch.pass_threshold = input.passThreshold;
    if (input.reviewThreshold !== undefined) patch.review_threshold = input.reviewThreshold;
    if (input.rubric !== undefined) patch.rubric = input.rubric.trim();
    if (input.failureModes !== undefined) patch.failure_modes = normalizeList(input.failureModes);
    const { data } = await checked(
      this.db
        .from("graders")
        .update(patch)
        .eq("organization_id", organizationId)
        .eq("id", input.graderId)
        .select("*")
        .single(),
    );
    if (!data) throw new Error("Grader not found for this organization.");
    await this.audit(actor, organizationId, "grader", input.graderId, "grader.updated", {
      active: data.active,
      model: data.model || null,
    });
    return mapGrader(data);
  }

  async updateEvalCase(actor: ActorContext, input: Parameters<EvalOpsStore["updateEvalCase"]>[1]) {
    const context = await this.resolveMembership(actor);
    requirePermission(context.membership, "reviewEvals");
    const organizationId = context.organizationId;
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

  async createExport(actor: ActorContext, projectId: string, input: CreateExportInput = {}) {
    const state: WorkspaceState = await this.getProjectState(actor, projectId);
    this.assertPaidAction(state, "exportReports");
    await this.assertQuota(state.organization.id, "exports", 1);
    const project = state.activeProject;
    if (!project) throw new Error("Project not found for this organization.");
    const type = input.type || "eval_pack_csv";
    const content =
      type === "audit_report_pdf"
        ? await buildAuditReportPdfOrThrow(state)
        : buildCsvExport({ evalCases: state.evalCases, issues: state.issues });
    const contentType = type === "audit_report_pdf" ? "application/pdf" : "text/csv";
    const fileName =
      type === "audit_report_pdf"
        ? `${slugify(project.name)}-audit-report.pdf`
        : `${slugify(project.name)}-eval-pack.csv`;
    const exportRecord: ExportRecord = {
      id: id("exp"),
      organizationId: project.organizationId,
      projectId: project.id,
      type,
      status: "generated",
      storageBucket: "evalops-exports",
      storagePath: `${project.organizationId}/${project.id}/${Date.now()}-${fileName}`,
      fileName,
      contentType,
      sizeBytes: typeof content === "string" ? Buffer.byteLength(content) : content.byteLength,
      createdAt: new Date().toISOString(),
    };
    await checked(
      this.db.storage
        .from("evalops-exports")
        .upload(exportRecord.storagePath, typeof content === "string" ? Buffer.from(content) : Buffer.from(content), {
          contentType,
          upsert: false,
        }),
    );
    await checked(this.db.from("exports").insert(toExportRow(exportRecord)));
    await this.insertUsage({
      organizationId: project.organizationId,
      projectId: project.id,
      metric: "exports",
      quantity: 1,
      source: "export.generated",
      sourceId: exportRecord.id,
      metadata: { type },
      createdAt: exportRecord.createdAt,
    });
    await this.audit(actor, project.organizationId, "export", exportRecord.id, "export.generated", {
      caseCount: state.evalCases.length,
      issueCount: state.issues.length,
    });
    return exportRecord;
  }

  async getExport(actor: ActorContext, exportId: string) {
    const { organizationId } = await this.resolveMembership(actor);
    const { data } = await checked(
      this.db.from("exports").select("*").eq("organization_id", organizationId).eq("id", exportId).single(),
    );
    if (!data) throw new Error("Export not found for this organization.");
    const record = mapExport(data);
    const downloaded = await checked(this.db.storage.from(record.storageBucket).download(record.storagePath));
    const content =
      record.contentType === "application/pdf"
        ? new Uint8Array(await downloaded.data.arrayBuffer())
        : await downloaded.data.text();
    return { record, content };
  }

  async requestFullProjectExport(actor: ActorContext, projectId: string) {
    const state: WorkspaceState = await this.getProjectState(actor, projectId);
    this.assertPaidAction(state, "exportReports");
    await this.assertQuota(state.organization.id, "exports", 1);
    const project = state.activeProject;
    if (!project) throw new Error("Project not found for this organization.");
    const now = new Date().toISOString();
    const fileName = `${slugify(project.name)}-full-project-export.json`;
    const exportRecord: ExportRecord = {
      id: id("exp"),
      organizationId: project.organizationId,
      projectId: project.id,
      type: "full_project_json",
      status: "queued",
      storageBucket: "evalops-exports",
      storagePath: `${project.organizationId}/${project.id}/${Date.now()}-${fileName}`,
      fileName,
      contentType: "application/json",
      sizeBytes: 0,
      metadata: { requestedBy: actor.userId },
      createdAt: now,
    };
    const job: ProcessingJob = {
      id: id("job"),
      organizationId: project.organizationId,
      projectId: project.id,
      action: "project_export",
      status: "queued",
      metadata: { exportId: exportRecord.id, type: exportRecord.type },
      createdAt: now,
    };
    const receipt = createReceipt({
      id: id("receipt"),
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
    await checked(this.db.from("exports").insert(toExportRow(exportRecord)));
    await checked(this.db.from("processing_jobs").insert(toProcessingJobRow(job)));
    await checked(this.db.from("data_operation_receipts").insert(toDataOperationReceiptRow(receipt)));
    await this.insertUsage({
      organizationId: project.organizationId,
      projectId: project.id,
      metric: "exports",
      quantity: 1,
      source: "project_export.requested",
      sourceId: exportRecord.id,
      metadata: { type: exportRecord.type },
      createdAt: now,
    });
    await this.audit(actor, project.organizationId, "export", exportRecord.id, "project_export.requested", {
      projectId: project.id,
      receiptId: receipt.id,
    });
    return { exportRecord, job, receipt };
  }

  async processFullProjectExport(actor: ActorContext, input: ProcessFullProjectExportInput) {
    const state: WorkspaceState = await this.getProjectState(actor, input.projectId);
    const project = state.activeProject;
    if (!project) throw new Error("Project not found for this organization.");
    const exportRecord = state.exports.find((item) => item.id === input.exportId);
    if (!exportRecord) throw new Error("Full project export not found for this project.");
    const job =
      state.processingJobs.find((item) => item.id === input.jobId) ||
      state.processingJobs.find((item) => item.metadata?.exportId === exportRecord.id);
    if (!job) throw new Error("Full project export job not found.");
    const receipt = state.dataOperationReceipts.find(
      (item) => item.id === exportRecord.receiptId || item.exportId === exportRecord.id,
    );
    if (!receipt) throw new Error("Full project export receipt not found.");
    if (exportRecord.status === "generated" && job.status === "completed" && receipt.status === "completed") {
      return { exportRecord, job, receipt };
    }

    const now = new Date().toISOString();
    job.status = "running";
    job.startedAt = job.startedAt || now;
    receipt.status = "running";
    exportRecord.status = "running";
    await checked(
      this.db.from("processing_jobs").update(toProcessingJobRow(job)).eq("organization_id", project.organizationId).eq("id", job.id),
    );
    await checked(
      this.db.from("exports").update(toExportRow(exportRecord)).eq("organization_id", project.organizationId).eq("id", exportRecord.id),
    );
    await checked(
      this.db
        .from("data_operation_receipts")
        .update(toDataOperationReceiptRow(receipt))
        .eq("organization_id", project.organizationId)
        .eq("id", receipt.id),
    );

    const content = encodeFullProjectExportPackage(
      buildFullProjectExportPackage(state, {
        exportId: exportRecord.id,
        requestedBy: actor.userId,
        generatedAt: now,
      }),
    );
    const checksum = checksumContent(content);
    exportRecord.status = "generated";
    exportRecord.sizeBytes = Buffer.byteLength(content);
    exportRecord.checksum = checksum;
    exportRecord.completedAt = now;
    exportRecord.metadata = {
      ...(exportRecord.metadata || {}),
      checksum,
      recordCounts: {
        traces: state.traces.length,
        evalCases: state.evalCases.length,
        graders: state.graders.length,
        reports: state.reports.length,
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

    await checked(
      this.db.storage.from(exportRecord.storageBucket).upload(exportRecord.storagePath, Buffer.from(content), {
        contentType: exportRecord.contentType,
        upsert: false,
      }),
    );
    await checked(
      this.db.from("exports").update(toExportRow(exportRecord)).eq("organization_id", project.organizationId).eq("id", exportRecord.id),
    );
    await checked(
      this.db.from("processing_jobs").update(toProcessingJobRow(job)).eq("organization_id", project.organizationId).eq("id", job.id),
    );
    await checked(
      this.db
        .from("data_operation_receipts")
        .update(toDataOperationReceiptRow(receipt))
        .eq("organization_id", project.organizationId)
        .eq("id", receipt.id),
    );
    await this.audit(actor, project.organizationId, "export", exportRecord.id, "project_export.completed", {
      projectId: project.id,
      checksum,
      sizeBytes: exportRecord.sizeBytes,
      receiptId: receipt.id,
    });
    return { exportRecord, job, receipt };
  }

  async requestProjectDeletion(actor: ActorContext, projectId: string, input: DeleteProjectInput) {
    const state: WorkspaceState = await this.getProjectState(actor, projectId);
    this.assertPaidAction(state, "manageProjects");
    const project = state.activeProject;
    if (!project) throw new Error("Project not found for this organization.");
    if (input.confirmationName.trim() !== project.name) {
      throw new ApiError(400, "Type the project name exactly to confirm deletion.", "confirmation_mismatch");
    }
    const now = new Date().toISOString();
    const job: ProcessingJob = {
      id: id("job"),
      organizationId: project.organizationId,
      projectId: project.id,
      action: "project_delete",
      status: "queued",
      metadata: { projectName: project.name },
      createdAt: now,
    };
    const receipt = createReceipt({
      id: id("receipt"),
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
    await checked(this.db.from("processing_jobs").insert(toProcessingJobRow(job)));
    await checked(this.db.from("data_operation_receipts").insert(toDataOperationReceiptRow(receipt)));
    await this.audit(actor, project.organizationId, "project", project.id, "project_delete.requested", {
      projectName: project.name,
      receiptId: receipt.id,
    });
    return { job, receipt };
  }

  async processProjectDeletion(actor: ActorContext, input: ProcessProjectDeletionInput) {
    const state: WorkspaceState = await this.getProjectState(actor, input.projectId);
    const project = state.activeProject;
    if (!project) throw new Error("Project not found for this organization.");
    const job = state.processingJobs.find((item) => item.id === input.jobId);
    if (!job) throw new Error("Project deletion job not found.");
    const receipt = state.dataOperationReceipts.find((item) => item.id === input.receiptId);
    if (!receipt) throw new Error("Project deletion receipt not found.");
    const now = new Date().toISOString();
    job.status = "running";
    job.startedAt = job.startedAt || now;
    receipt.status = "running";
    await checked(this.db.from("processing_jobs").update(toProcessingJobRow(job)).eq("organization_id", project.organizationId).eq("id", job.id));
    await checked(
      this.db
        .from("data_operation_receipts")
        .update(toDataOperationReceiptRow(receipt))
        .eq("organization_id", project.organizationId)
        .eq("id", receipt.id),
    );

    const storageObjects = [...state.uploadedFiles, ...state.exports];
    await removeStorageObjects(this.db, storageObjects.map((item) => ({
      bucket: item.storageBucket,
      path: item.storagePath,
    })));
    const deletedCounts = {
      traceImports: state.traceImports.length,
      traces: state.traces.length,
      uploadedFiles: state.uploadedFiles.length,
      processingJobs: state.processingJobs.length,
      evalCases: state.evalCases.length,
      graders: state.graders.length,
      issues: state.issues.length,
      reports: state.reports.length,
      exports: state.exports.length,
    };
    receipt.status = "completed";
    receipt.completedAt = now;
    receipt.summary = `Project ${project.name} and associated storage objects were deleted.`;
    receipt.metadata = {
      ...receipt.metadata,
      deletedCounts,
      storageObjectsDeleted: storageObjects.length,
      completedAt: now,
    };
    await checked(
      this.db
        .from("data_operation_receipts")
        .update(toDataOperationReceiptRow(receipt))
        .eq("organization_id", project.organizationId)
        .eq("id", receipt.id),
    );
    await this.audit(actor, project.organizationId, "project", project.id, "project_delete.completed", {
      projectName: project.name,
      deletedCounts,
      storageObjectsDeleted: storageObjects.length,
      receiptId: receipt.id,
    });
    await checked(this.db.from("projects").delete().eq("organization_id", project.organizationId).eq("id", project.id));
    return { receipt };
  }

  async purgeRawProjectData(actor: ActorContext, input: PurgeRawProjectDataInput) {
    const state: WorkspaceState = await this.getProjectState(actor, input.projectId);
    requirePermission(state.membership, "manageSettings");
    const project = state.activeProject;
    if (!project) throw new Error("Project not found for this organization.");
    const now = input.now || new Date().toISOString();
    const matchesTraceImport = (traceImportId?: string) => !input.traceImportId || traceImportId === input.traceImportId;
    const files = state.uploadedFiles.filter((file) => matchesTraceImport(file.traceImportId) && !file.rawPurgedAt);
    const traces = state.traces.filter((trace) => matchesTraceImport(trace.traceImportId) && !trace.rawPurgedAt);
    const imports = state.traceImports.filter((traceImport) =>
      files.some((file) => file.traceImportId === traceImport.id) ||
      traces.some((trace) => trace.traceImportId === traceImport.id),
    );

    await removeStorageObjects(this.db, files.map((file) => ({ bucket: file.storageBucket, path: file.storagePath })));
    if (files.length) {
      await checked(
        this.db
          .from("uploaded_files")
          .update({ raw_purged_at: now, storage_deleted_at: now })
          .eq("organization_id", project.organizationId)
          .eq("project_id", project.id)
          .in("id", files.map((file) => file.id)),
      );
    }
    if (traces.length) {
      await checked(
        this.db
          .from("traces")
          .update({ input: null, output: null, metadata: null, raw_purged_at: now })
          .eq("organization_id", project.organizationId)
          .eq("project_id", project.id)
          .in("id", traces.map((trace) => trace.id)),
      );
    }
    if (imports.length) {
      await checked(
        this.db
          .from("trace_imports")
          .update({ raw_purged_at: now })
          .eq("organization_id", project.organizationId)
          .eq("project_id", project.id)
          .in("id", imports.map((traceImport) => traceImport.id)),
      );
    }

    const receipt = createReceipt({
      id: id("receipt"),
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
    await checked(this.db.from("data_operation_receipts").insert(toDataOperationReceiptRow(receipt)));
    await this.audit(actor, project.organizationId, "project", project.id, "raw_trace_purge.completed", {
      reason: input.reason,
      traceImportId: input.traceImportId,
      filesPurged: files.length,
      tracesPurged: traces.length,
      receiptId: receipt.id,
    });
    return receipt;
  }

  async rerunEvaluation(actor: ActorContext, projectId: string) {
    const state: WorkspaceState = await this.getProjectState(actor, projectId);
    this.assertPaidAction(state, "runGenerations");
    await this.assertQuota(state.organization.id, "openai_generations", 1);
    const project = state.activeProject;
    if (!project) throw new Error("Project not found for this organization.");
    const now = new Date().toISOString();
    const currentPrompt = state.promptVersions.find((item) => item.status === "current") || state.promptVersions[0];
    const run: EvalRun = {
      id: id("run"),
      organizationId: project.organizationId,
      projectId: project.id,
      status: "running",
      runType: "manual",
      promptVersionId: currentPrompt?.id,
      passRate: 0,
      totalCases: state.evalCases.length,
      failedCases: 0,
      reviewCases: 0,
      totalResults: 0,
      startedAt: now,
    };
    await checked(this.db.from("eval_runs").insert(toEvalRunRow(run)));
    const results: StoredEvalResult[] = state.evalCases.flatMap((evalCase) =>
      state.graders.filter((grader) => grader.active).map((grader) =>
        ({
          ...executeDeterministicGrader({
            evalCase,
            grader,
            trace: evalCase.traceId ? state.traces.find((trace) => trace.id === evalCase.traceId) : undefined,
            evalRunId: run.id,
            promptVersionId: currentPrompt?.id,
            now,
          }),
          organizationId: project.organizationId,
          projectId: project.id,
        }),
      ),
    );
    const summary = summarizeEvalResults(results);
    run.status = "completed";
    run.passRate = summary.passRate;
    run.averageScore = summary.averageScore;
    run.failedCases = summary.failedCases;
    run.reviewCases = summary.reviewCases;
    run.totalResults = results.length;
    run.completedAt = new Date().toISOString();
    if (results.length) await checked(this.db.from("eval_results").upsert(results.map(toEvalResultRow)));
    await Promise.all(
      state.evalCases.map((evalCase) => {
        const caseResults = results.filter((result) => result.evalCaseId === evalCase.id);
        if (!caseResults.length) return Promise.resolve();
        const score = Math.round(caseResults.reduce((total, result) => total + result.score, 0) / caseResults.length);
        const status = caseResults.some((result) => result.status === "failed")
          ? "failed"
          : caseResults.some((result) => result.status === "review")
            ? "review"
            : "passed";
        return checked(
          this.db
            .from("eval_cases")
            .update({ last_result: score, status, updated_at: run.completedAt })
            .eq("organization_id", project.organizationId)
            .eq("id", evalCase.id),
        );
      }),
    );
    await checked(
      this.db
        .from("eval_runs")
        .update(toEvalRunRow(run))
        .eq("organization_id", project.organizationId)
        .eq("id", run.id),
    );
    await this.insertUsage({
      organizationId: project.organizationId,
      projectId: project.id,
      metric: "openai_generations",
      quantity: 1,
      source: "eval_run.manual",
      sourceId: run.id,
      metadata: { totalCases: run.totalCases, totalResults: run.totalResults },
      createdAt: now,
    });
    await this.audit(actor, project.organizationId, "eval_run", run.id, "review_rule.executed", {
      totalCases: run.totalCases,
      totalResults: run.totalResults,
      failedCases: run.failedCases,
      passRate: run.passRate,
    });
    return run;
  }

  async upsertHumanLabel(actor: ActorContext, input: UpsertHumanLabelInput) {
    const context = await this.resolveMembership(actor);
    requirePermission(context.membership, "reviewEvals");
    const organizationId = context.organizationId;
    const { data: evalCase } = await checked(
      this.db
        .from("eval_cases")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("id", input.evalCaseId)
        .single(),
    );
    if (!evalCase) throw new Error("Eval case not found for this organization.");
    const { data: grader } = await checked(
      this.db
        .from("graders")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("project_id", evalCase.project_id)
        .eq("id", input.graderId)
        .single(),
    );
    if (!grader) throw new Error("Grader not found for this eval case.");
    const now = new Date().toISOString();
    const label: StoredHumanLabel = {
      id: id("label"),
      organizationId,
      projectId: evalCase.project_id,
      evalCaseId: evalCase.id,
      graderId: grader.id,
      score: input.score,
      status: input.status,
      notes: input.notes?.trim() || undefined,
      labeledBy: actor.userId,
      labeledAt: now,
      updatedAt: now,
    };
    const { data } = await checked(
      this.db
        .from("human_labels")
        .upsert(toHumanLabelRow(label), {
          onConflict: "organization_id,project_id,eval_case_id,grader_id",
        })
        .select("*")
        .single(),
    );
    const saved = mapHumanLabel(data);
    await this.upsertCalibrationForLabel(actor, saved);
    await this.audit(actor, organizationId, "human_label", saved.id, "human_label.upserted", {
      evalCaseId: saved.evalCaseId,
      graderId: saved.graderId,
      status: saved.status,
    });
    return saved;
  }

  async promotePromptCandidate(actor: ActorContext, projectId: string, candidateId: string) {
    const state: WorkspaceState = await this.getProjectState(actor, projectId);
    this.assertPaidAction(state, "runGenerations");
    await this.assertQuota(state.organization.id, "openai_generations", 1);
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
      prompt: candidate.promptBody,
      status: "promoted",
      createdAt: new Date().toISOString(),
    };
    await checked(this.db.from("prompt_versions").insert(toPromptVersionRow(version)));
    await this.insertUsage({
      organizationId: project.organizationId,
      projectId: project.id,
      metric: "openai_generations",
      quantity: 1,
      source: "prompt.promoted",
      sourceId: version.id,
      metadata: { candidateId },
      createdAt: version.createdAt,
    });
    await this.audit(actor, project.organizationId, "prompt_version", version.id, "prompt.promoted", {
      candidateId,
    });
    return version;
  }

  private async resolveMembership(actor: ActorContext): Promise<{ organizationId: string; membership: OrganizationMembership }> {
    const { data } = await checked(
      this.db
        .from("organization_memberships")
        .select("*")
        .eq("user_id", actor.userId)
        .order("created_at"),
    );
    const membership = actor.organizationId
      ? (data || []).find((item: any) => item.organization_id === actor.organizationId)
      : (data || [])[0];
    if (!membership) {
      const workspace: WorkspaceState = await this.ensureWorkspace(actor);
      return { organizationId: workspace.organization.id, membership: workspace.membership };
    }
    return { organizationId: membership.organization_id as string, membership: mapMembership(membership) };
  }

  private async ensureBillingRow(organizationId: string) {
    const now = new Date().toISOString();
    const existing = await checked(
      this.db.from("organization_billing").select("*").eq("organization_id", organizationId).maybeSingle(),
    );
    if (existing.data) return mapOrganizationBilling(existing.data);
    const { data } = await checked(
      this.db.from("organization_billing").insert({
        organization_id: organizationId,
        plan_id: "starter",
        status: "setup_required",
        cancel_at_period_end: false,
        metadata: {},
        created_at: now,
        updated_at: now,
      }).select("*").single(),
    );
    return mapOrganizationBilling(data);
  }

  private async buildBillingOverview(organizationId: string): Promise<BillingOverview> {
    const billing = await this.ensureBillingRow(organizationId);
    const period = getCurrentMonthlyPeriod();
    const { data: usageRows } = await checked(
      this.db
        .from("usage_events")
        .select("*")
        .eq("organization_id", organizationId)
        .gte("created_at", period.periodStart)
        .lt("created_at", period.periodEnd),
    );
    const usage = summarizeUsage(
      (usageRows || []).map((row: any) => ({
        metric: row.metric,
        quantity: Number(row.quantity),
        occurredAt: row.created_at,
      })),
      period,
    );
    const [{ count: projectCount }, { count: memberCount }, { count: inviteCount }] = await Promise.all([
      checked(this.db.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active")),
      checked(this.db.from("organization_memberships").select("id", { count: "exact", head: true }).eq("organization_id", organizationId)),
      checked(this.db.from("organization_invitations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "pending").gt("expires_at", new Date().toISOString())),
    ]);
    usage.projects = projectCount || 0;
    usage.seats = (memberCount || 0) + (inviteCount || 0);
    return {
      billing,
      usage,
      period,
      canUseFeatures: canUseBillingFeatures(billing.status),
    };
  }

  private async assertQuota(organizationId: string, metric: Parameters<typeof canConsumeQuota>[0]["metric"], quantity = 1) {
    const overview = await this.buildBillingOverview(organizationId);
    const decision = canConsumeQuota({
      planId: overview.billing.planId,
      metric,
      currentUsage: overview.usage[metric],
      quantity,
    });
    if (!decision.allowed) {
      throw new ApiError(
        409,
        `The ${overview.billing.planId} plan limit for ${metric.replace(/_/g, " ")} has been reached.`,
        "quota_exceeded",
      );
    }
  }

  private assertPaidAction(state: WorkspaceState, permission: RolePermission) {
    requirePermission(state.membership, permission);
    if (!state.billing.canUseFeatures) {
      throw new ApiError(
        402,
        "Start a trial or update billing before using paid EvalOps actions.",
        "payment_required",
      );
    }
  }

  private async insertUsage(input: {
    organizationId: string;
    projectId?: string;
    metric: StoredUsageEvent["metric"];
    quantity: number;
    source: string;
    sourceId?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
  }) {
    const period = getCurrentMonthlyPeriod(new Date(input.createdAt));
    const row = {
      id: id("usage"),
      organization_id: input.organizationId,
      project_id: input.projectId || null,
      metric: input.metric,
      quantity: input.quantity,
      source: input.source,
      source_id: input.sourceId || null,
      period_start: period.periodStart,
      metadata: input.metadata || {},
      created_at: input.createdAt,
    };
    const { data } = await checked(this.db.from("usage_events").insert(row).select("*").single());
    return mapUsageEvent(data);
  }

  private async listOrganizationMembers(organizationId: string) {
    const { data } = await checked(
      this.db.from("organization_memberships").select("*").eq("organization_id", organizationId).order("created_at"),
    );
    return (data || []).map(mapMembership);
  }

  private async listOrganizationInvitations(organizationId: string) {
    const { data } = await checked(
      this.db.from("organization_invitations").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    );
    return (data || []).map(mapInvitation);
  }

  private async listSupportRequests(organizationId: string) {
    const { data } = await checked(
      this.db.from("support_requests").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    );
    return (data || []).map(mapSupportRequest);
  }

  private async assertCanChangeOwner(organizationId: string, membershipId: string) {
    const { count } = await checked(
      this.db.from("organization_memberships").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("role", "owner").neq("id", membershipId),
    );
    if (!count) throw new ApiError(409, "Every organization needs at least one owner.", "last_owner");
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
      evalResults,
      humanLabels,
      graderCalibrationRuns,
      graderCalibrationResults,
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
      checked(this.db.from("eval_results").select("*").eq("organization_id", organizationId).eq("project_id", projectId).order("created_at", { ascending: false })),
      checked(this.db.from("human_labels").select("*").eq("organization_id", organizationId).eq("project_id", projectId).order("updated_at", { ascending: false })),
      checked(this.db.from("grader_calibration_runs").select("*").eq("organization_id", organizationId).eq("project_id", projectId).order("created_at", { ascending: false })),
      checked(this.db.from("grader_calibration_results").select("*").eq("organization_id", organizationId).eq("project_id", projectId).order("created_at", { ascending: false })),
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
      evalResults: (evalResults.data || []).map(mapEvalResult),
      humanLabels: (humanLabels.data || []).map(mapHumanLabel),
      graderCalibrationRuns: (graderCalibrationRuns.data || []).map(mapGraderCalibrationRun),
      graderCalibrationResults: (graderCalibrationResults.data || []).map(mapGraderCalibrationResult),
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
    artifacts: AuditArtifacts,
    traces: StoredTrace[],
    provenance?: { traceImportId: string; jobId: string },
  ) {
    const now = new Date().toISOString();
    const provenanceMetadata = provenance
      ? { sourceJobId: provenance.jobId, sourceTraceImportId: provenance.traceImportId }
      : {};
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
                passThreshold: grader.passThreshold ?? 0.8,
                reviewThreshold: grader.reviewThreshold ?? 0.6,
                rubric: grader.rubric || grader.description,
                failureModes: grader.failureModes || [],
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
    const clusters = artifacts.failureClusters?.length
      ? artifacts.failureClusters.map((cluster) => ({
          ...cluster,
          id: id("cluster"),
          organizationId: project.organizationId,
          projectId: project.id,
          createdAt: now,
        }))
      : buildFailureClusters(project, issues, now);
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
          ...provenanceMetadata,
        }),
      ),
      ...issues.map((item) =>
        this.audit(actor, project.organizationId, "issue", item.id, "issue.created", {
          severity: item.severity,
          status: item.status,
          ...provenanceMetadata,
        }),
      ),
      this.audit(actor, project.organizationId, "eval_run", run.id, "review_rule.executed", {
        totalCases: run.totalCases,
        passRate: run.passRate,
        ...provenanceMetadata,
      }),
      this.audit(actor, project.organizationId, "report", report.id, "report.generated", {
        readinessScore: report.readinessScore,
        ...provenanceMetadata,
      }),
    ]);
    if (artifacts.promptCandidates?.length) {
      await checked(
        this.db
          .from("prompt_candidates")
          .delete()
          .eq("organization_id", project.organizationId)
          .eq("project_id", project.id),
      );
      await checked(
        this.db.from("prompt_candidates").insert(
          artifacts.promptCandidates.map((candidate) =>
            toPromptCandidateRow({
              ...candidate,
              id: id("cand"),
              organizationId: project.organizationId,
              projectId: project.id,
              createdAt: now,
            }),
          ),
        ),
      );
    }
    if (artifacts.routingRules?.length) {
      await checked(
        this.db
          .from("routing_rules")
          .delete()
          .eq("organization_id", project.organizationId)
          .eq("project_id", project.id),
      );
      await checked(
        this.db.from("routing_rules").insert(
          artifacts.routingRules.map((rule) =>
            toRoutingRuleRow({
              ...rule,
              id: id("route"),
              organizationId: project.organizationId,
              projectId: project.id,
              createdAt: now,
            }),
          ),
        ),
      );
    }
    if (artifacts.cacheRecommendations?.length) {
      await checked(
        this.db
          .from("cache_recommendations")
          .delete()
          .eq("organization_id", project.organizationId)
          .eq("project_id", project.id),
      );
      await checked(
        this.db.from("cache_recommendations").insert(
          artifacts.cacheRecommendations.map((recommendation) =>
            toCacheRecommendationRow({
              ...recommendation,
              id: id("cache"),
              organizationId: project.organizationId,
              projectId: project.id,
              createdAt: now,
            }),
          ),
        ),
      );
    }
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
    const promptVersion: PromptVersion = {
      id: id("prompt"),
      organizationId,
      projectId,
      label: "Current production prompt",
      prompt: "Answer from available context, avoid unsupported claims, and escalate high-risk cases.",
      status: "current",
      createdAt: now,
    };
    await checked(
      this.db.from("prompt_versions").insert(toPromptVersionRow(promptVersion)),
    );
    const candidates: PromptCandidate[] = [
      {
        id: id("cand"),
        organizationId,
        projectId,
        title: "Escalation-first support prompt",
        promptBody: [
          "You are a support assistant for high-friction customer conversations.",
          "Detect frustration, repeated failure, refund, privacy, and safety signals.",
          "Escalate high-risk cases to a human with a concise evidence summary.",
        ].join("\n"),
        sourcePromptVersionId: promptVersion.id,
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
        id: id("cand"),
        organizationId,
        projectId,
        title: "Billing-safe prompt",
        promptBody: [
          "You are a support assistant for billing questions.",
          "Confirm the account context before refund guidance.",
          "State what evidence supports the answer and when to escalate.",
        ].join("\n"),
        sourcePromptVersionId: promptVersion.id,
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
      confidence: index >= 3 ? 0.82 : 0.74,
      evidenceRefs: [],
      calculationBasis: "Derived from intent risk, latest eval pass rate, and static pilot traffic assumptions.",
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
        confidence: 0.76,
        evidenceRefs: [],
        calculationBasis: "Assumes repeated static policy prefix across imported support turns.",
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
        confidence: 0.68,
        evidenceRefs: [],
        calculationBasis: "Assumes stable tool schema ordering improves cache hit rate across support turns.",
        createdAt: now,
      },
    ];
    await checked(this.db.from("cache_recommendations").insert(cacheRecommendations.map(toCacheRecommendationRow)));
    await this.audit(actor, organizationId, "project", projectId, "optimizer.initialized", {
      candidateCount: candidates.length,
    });
  }

  private async upsertCalibrationForLabel(actor: ActorContext, label: StoredHumanLabel) {
    const { data: latestResultRows } = await checked(
      this.db
        .from("eval_results")
        .select("*")
        .eq("organization_id", label.organizationId)
        .eq("project_id", label.projectId)
        .eq("eval_case_id", label.evalCaseId)
        .eq("grader_id", label.graderId)
        .order("created_at", { ascending: false })
        .limit(1),
    );
    const latestResult = latestResultRows?.[0] ? mapEvalResult(latestResultRows[0]) : undefined;
    const now = new Date().toISOString();
    const scoreDelta = Math.abs((latestResult?.score ?? label.score) - label.score);
    const severity = latestResult && latestResult.status !== label.status
      ? "high"
      : scoreDelta >= 25
        ? "medium"
        : scoreDelta >= 10
          ? "low"
          : "none";
    const run: GraderCalibrationRun = {
      id: id("cal"),
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
      id: id("calres"),
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
    await checked(this.db.from("grader_calibration_runs").insert(toGraderCalibrationRunRow(run)));
    await checked(this.db.from("grader_calibration_results").insert(toGraderCalibrationResultRow(result)));
    const { data: labels } = await checked(
      this.db
        .from("human_labels")
        .select("id")
        .eq("organization_id", label.organizationId)
        .eq("project_id", label.projectId)
        .eq("grader_id", label.graderId),
    );
    const { data: disagreements } = await checked(
      this.db
        .from("grader_calibration_results")
        .select("id")
        .eq("organization_id", label.organizationId)
        .eq("project_id", label.projectId)
        .eq("grader_id", label.graderId)
        .neq("disagreement_severity", "none"),
    );
    const totalLabels = labels?.length || 0;
    const disagreementCount = disagreements?.length || 0;
    const agreement = totalLabels
      ? Math.max(0, Math.round(((totalLabels - disagreementCount) / totalLabels) * 100) / 100)
      : 1;
    await checked(
      this.db
        .from("graders")
        .update({
          agreement,
          health: agreement >= 0.75 ? "healthy" : "low_agreement",
          last_calibrated_at: now,
          updated_at: now,
        })
        .eq("organization_id", label.organizationId)
        .eq("id", label.graderId),
    );
    await this.audit(actor, label.organizationId, "calibration_result", result.id, "grader.calibrated", {
      evalCaseId: label.evalCaseId,
      graderId: label.graderId,
      disagreementSeverity: severity,
      agreement,
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

  private async listDataOperationReceipts(organizationId: string): Promise<DataOperationReceipt[]> {
    const { data } = await checked(
      this.db
        .from("data_operation_receipts")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100),
    );
    return (data || []).map(mapDataOperationReceipt);
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

function requirePermission(membership: OrganizationMembership, permission: RolePermission) {
  if (!canPerformPermission(membership.role, permission)) {
    throw new ApiError(403, "Your role does not allow this action.", "forbidden");
  }
}

async function removeStorageObjects(db: DbClient, objects: Array<{ bucket: string; path: string }>) {
  const byBucket = new Map<string, string[]>();
  objects.forEach((object) => {
    if (!object.path) return;
    byBucket.set(object.bucket, [...(byBucket.get(object.bucket) || []), object.path]);
  });

  for (const [bucket, paths] of byBucket.entries()) {
    for (let index = 0; index < paths.length; index += 1000) {
      await checked(db.storage.from(bucket).remove(paths.slice(index, index + 1000)));
    }
  }
}

function emptyProjectRecords(): Omit<WorkspaceState, "organization" | "user" | "membership" | "billing" | "members" | "invitations" | "supportRequests" | "projects" | "activeProject" | "auditEvents"> {
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
  };
}

async function buildAuditReportPdfOrThrow(state: WorkspaceState) {
  if (!state.reports.length) {
    throw new ApiError(409, "Generate an audit report before exporting PDF.", "report_not_ready");
  }
  return buildAuditReportPdf(state);
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

function normalizeList(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 12);
}

function sourceFromFileName(fileName: string, contentType = ""): TraceImport["source"] {
  return inferTraceSourceType(fileName, contentType);
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
const mapOrganizationBilling = (row: any): OrganizationBilling => ({
  organizationId: row.organization_id,
  planId: row.plan_id,
  status: row.status,
  stripeCustomerId: row.stripe_customer_id || undefined,
  stripeSubscriptionId: row.stripe_subscription_id || undefined,
  stripePriceId: row.stripe_price_id || undefined,
  stripeCurrentPeriodStart: row.stripe_current_period_start || undefined,
  stripeCurrentPeriodEnd: row.stripe_current_period_end || undefined,
  trialEndsAt: row.trial_ends_at || undefined,
  cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
  metadata: row.metadata || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const mapUsageEvent = (row: any): StoredUsageEvent => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id || undefined,
  metric: row.metric,
  quantity: Number(row.quantity),
  source: row.source,
  sourceId: row.source_id || undefined,
  periodStart: row.period_start,
  metadata: row.metadata || {},
  createdAt: row.created_at,
});
const mapInvitation = (row: any): OrganizationInvitation => ({
  id: row.id,
  organizationId: row.organization_id,
  email: row.email,
  role: row.role,
  status: row.status,
  invitedBy: row.invited_by,
  acceptedBy: row.accepted_by || undefined,
  expiresAt: row.expires_at,
  acceptedAt: row.accepted_at || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const mapSupportRequest = (row: any): SupportRequest => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id || undefined,
  actorUserId: row.actor_user_id,
  requestType: row.request_type,
  priority: row.priority,
  subject: row.subject,
  message: row.message,
  status: row.status,
  metadata: row.metadata || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
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
  rawRetentionExpiresAt: row.raw_retention_expires_at || undefined,
  rawPurgedAt: row.raw_purged_at || undefined,
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
  metadata: row.metadata ?? null,
  rawRetentionExpiresAt: row.raw_retention_expires_at || undefined,
  rawPurgedAt: row.raw_purged_at || undefined,
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
  rawRetentionExpiresAt: row.raw_retention_expires_at || undefined,
  rawPurgedAt: row.raw_purged_at || undefined,
  storageDeletedAt: row.storage_deleted_at || undefined,
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
  metadata: row.metadata || {},
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
  passThreshold: Number(row.pass_threshold ?? 0.8),
  reviewThreshold: Number(row.review_threshold ?? 0.6),
  rubric: row.rubric || row.description,
  failureModes: row.failure_modes || [],
  lastCalibratedAt: row.last_calibrated_at || undefined,
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
  runType: row.run_type || "manual",
  promptVersionId: row.prompt_version_id || undefined,
  promptCandidateId: row.prompt_candidate_id || undefined,
  passRate: Number(row.pass_rate),
  averageScore: row.average_score == null ? undefined : Number(row.average_score),
  totalCases: row.total_cases,
  failedCases: row.failed_cases,
  reviewCases: row.review_cases ?? 0,
  totalResults: row.total_results ?? 0,
  metadata: row.metadata || {},
  startedAt: row.started_at,
  completedAt: row.completed_at || undefined,
});
const mapEvalResult = (row: any): StoredEvalResult => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  evalRunId: row.eval_run_id,
  evalCaseId: row.eval_case_id,
  graderId: row.grader_id,
  status: row.status,
  score: Number(row.score),
  rationale: row.rationale,
  evidenceRefs: row.evidence_refs || [],
  promptVersionId: row.prompt_version_id || undefined,
  promptCandidateId: row.prompt_candidate_id || undefined,
  model: row.model || undefined,
  latencyMs: row.latency_ms ?? undefined,
  estimatedCost: row.estimated_cost == null ? undefined : Number(row.estimated_cost),
  tokenUsage: row.token_usage || undefined,
  confidence: row.confidence == null ? undefined : Number(row.confidence),
  createdAt: row.created_at,
});
const mapHumanLabel = (row: any): StoredHumanLabel => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  evalCaseId: row.eval_case_id,
  graderId: row.grader_id,
  score: Number(row.score),
  status: row.status,
  notes: row.notes || undefined,
  labeledBy: row.labeled_by,
  labeledAt: row.labeled_at,
  updatedAt: row.updated_at,
});
const mapGraderCalibrationRun = (row: any): GraderCalibrationRun => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  graderId: row.grader_id,
  status: row.status,
  agreement: Number(row.agreement),
  totalLabels: row.total_labels,
  disagreementCount: row.disagreement_count,
  createdAt: row.created_at,
});
const mapGraderCalibrationResult = (row: any): StoredGraderCalibrationResult => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  calibrationRunId: row.calibration_run_id,
  evalCaseId: row.eval_case_id,
  graderId: row.grader_id,
  humanLabelId: row.human_label_id,
  evalResultId: row.eval_result_id || undefined,
  humanScore: Number(row.human_score),
  judgeScore: row.judge_score == null ? undefined : Number(row.judge_score),
  scoreDelta: Number(row.score_delta),
  disagreementSeverity: row.disagreement_severity,
  reviewStatus: row.review_status,
  createdAt: row.created_at,
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
  promptBody: row.prompt_body || row.explanation,
  sourcePromptVersionId: row.source_prompt_version_id || undefined,
  diffSummary: row.diff_summary || undefined,
  expectedQualityLift: Number(row.expected_quality_lift),
  expectedCostDelta: Number(row.expected_cost_delta),
  expectedLatencyDeltaMs: row.expected_latency_delta_ms ?? undefined,
  baselinePassRate: row.baseline_pass_rate == null ? undefined : Number(row.baseline_pass_rate),
  candidatePassRate: row.candidate_pass_rate == null ? undefined : Number(row.candidate_pass_rate),
  regressionRisk: row.regression_risk,
  explanation: row.explanation,
  confidence: row.confidence == null ? undefined : Number(row.confidence),
  evidenceRefs: row.evidence_refs || [],
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
  confidence: row.confidence == null ? undefined : Number(row.confidence),
  evidenceRefs: row.evidence_refs || [],
  calculationBasis: row.calculation_basis || undefined,
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
  confidence: row.confidence == null ? undefined : Number(row.confidence),
  evidenceRefs: row.evidence_refs || [],
  calculationBasis: row.calculation_basis || undefined,
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
  evidenceRefs: row.evidence_refs || [],
  confidence: row.confidence == null ? undefined : Number(row.confidence),
  structuredSections: row.structured_sections || [],
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
  checksum: row.checksum || undefined,
  receiptId: row.receipt_id || undefined,
  metadata: row.metadata || {},
  completedAt: row.completed_at || undefined,
  expiresAt: row.expires_at || undefined,
  createdAt: row.created_at,
});
const mapDataOperationReceipt = (row: any): DataOperationReceipt => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id || undefined,
  operation: row.operation,
  status: row.status,
  actorUserId: row.actor_user_id,
  summary: row.summary,
  metadata: row.metadata || {},
  exportId: row.export_id || undefined,
  jobId: row.job_id || undefined,
  createdAt: row.created_at,
  completedAt: row.completed_at || undefined,
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
  raw_retention_expires_at: item.rawRetentionExpiresAt || null,
  raw_purged_at: item.rawPurgedAt || null,
  storage_deleted_at: item.storageDeletedAt || null,
  created_at: item.createdAt,
});
const toProcessingJobRow = (item: ProcessingJob) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  trace_import_id: item.traceImportId || null,
  action: item.action,
  status: item.status,
  error_message: item.errorMessage || null,
  metadata: item.metadata || {},
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
  raw_retention_expires_at: item.rawRetentionExpiresAt || null,
  raw_purged_at: item.rawPurgedAt || null,
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
  pass_threshold: item.passThreshold,
  review_threshold: item.reviewThreshold,
  rubric: item.rubric,
  failure_modes: item.failureModes,
  last_calibrated_at: item.lastCalibratedAt || null,
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
  run_type: item.runType || "manual",
  prompt_version_id: item.promptVersionId || null,
  prompt_candidate_id: item.promptCandidateId || null,
  pass_rate: item.passRate,
  average_score: item.averageScore ?? null,
  total_cases: item.totalCases,
  failed_cases: item.failedCases,
  review_cases: item.reviewCases || 0,
  total_results: item.totalResults || 0,
  metadata: item.metadata || {},
  started_at: item.startedAt,
  completed_at: item.completedAt || null,
});
const toEvalResultRow = (item: StoredEvalResult) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  eval_run_id: item.evalRunId,
  eval_case_id: item.evalCaseId,
  grader_id: item.graderId,
  status: item.status,
  score: item.score,
  rationale: item.rationale,
  evidence_refs: item.evidenceRefs || [],
  prompt_version_id: item.promptVersionId || null,
  prompt_candidate_id: item.promptCandidateId || null,
  model: item.model || null,
  latency_ms: item.latencyMs ?? null,
  estimated_cost: item.estimatedCost ?? null,
  token_usage: item.tokenUsage || null,
  confidence: item.confidence ?? null,
  created_at: item.createdAt,
});
const toHumanLabelRow = (item: StoredHumanLabel) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  eval_case_id: item.evalCaseId,
  grader_id: item.graderId,
  score: item.score,
  status: item.status,
  notes: item.notes || null,
  labeled_by: item.labeledBy,
  labeled_at: item.labeledAt,
  updated_at: item.updatedAt,
});
const toGraderCalibrationRunRow = (item: GraderCalibrationRun) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  grader_id: item.graderId,
  status: item.status,
  agreement: item.agreement,
  total_labels: item.totalLabels,
  disagreement_count: item.disagreementCount,
  created_at: item.createdAt,
});
const toGraderCalibrationResultRow = (item: StoredGraderCalibrationResult) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId,
  calibration_run_id: item.calibrationRunId,
  eval_case_id: item.evalCaseId,
  grader_id: item.graderId,
  human_label_id: item.humanLabelId,
  eval_result_id: item.evalResultId || null,
  human_score: item.humanScore,
  judge_score: item.judgeScore ?? null,
  score_delta: item.scoreDelta,
  disagreement_severity: item.disagreementSeverity,
  review_status: item.reviewStatus,
  created_at: item.createdAt,
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
  prompt_body: item.promptBody,
  source_prompt_version_id: item.sourcePromptVersionId || null,
  diff_summary: item.diffSummary || null,
  expected_quality_lift: item.expectedQualityLift,
  expected_cost_delta: item.expectedCostDelta,
  expected_latency_delta_ms: item.expectedLatencyDeltaMs ?? null,
  baseline_pass_rate: item.baselinePassRate ?? null,
  candidate_pass_rate: item.candidatePassRate ?? null,
  regression_risk: item.regressionRisk,
  explanation: item.explanation,
  confidence: item.confidence ?? null,
  evidence_refs: item.evidenceRefs || [],
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
  confidence: item.confidence ?? null,
  evidence_refs: item.evidenceRefs || [],
  calculation_basis: item.calculationBasis || null,
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
  confidence: item.confidence ?? null,
  evidence_refs: item.evidenceRefs || [],
  calculation_basis: item.calculationBasis || null,
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
  evidence_refs: item.evidenceRefs || [],
  confidence: item.confidence ?? null,
  structured_sections: item.structuredSections || [],
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
  checksum: item.checksum || null,
  receipt_id: item.receiptId || null,
  metadata: item.metadata || {},
  completed_at: item.completedAt || null,
  expires_at: item.expiresAt || null,
  created_at: item.createdAt,
});
const toDataOperationReceiptRow = (item: DataOperationReceipt) => ({
  id: item.id,
  organization_id: item.organizationId,
  project_id: item.projectId || null,
  operation: item.operation,
  status: item.status,
  actor_user_id: item.actorUserId,
  summary: item.summary,
  metadata: item.metadata || {},
  export_id: item.exportId || null,
  job_id: item.jobId || null,
  created_at: item.createdAt,
  completed_at: item.completedAt || null,
});
