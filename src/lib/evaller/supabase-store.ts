/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/server/auth";
import { getEvalOpsStore } from "@/lib/server/store";
import { createSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { runEvallerAiTest } from "./ai";
import {
  DEFAULT_EVALLER_PROMPT,
  DEFAULT_SCENARIOS,
  DEFAULT_SUCCESS_CRITERIA,
  buildDefaultAiTest,
  buildRunDetail,
  buildRunSummary,
} from "./logic";
import { buildReadinessReportRecord } from "./readiness-report";
import { validateRunnableWorkspace } from "./schemas";
import type {
  EvallerActor,
  EvallerAiTest,
  EvallerFailurePattern,
  EvallerPromptSuggestion,
  EvallerPromptVersion,
  EvallerReadinessReportRecord,
  EvallerReviewComment,
  EvallerRunDetail,
  EvallerRunSummary,
  EvallerScenario,
  EvallerScenarioResult,
  EvallerStore,
  EvallerSuccessCriterion,
  EvallerWorkspace,
  EvallerWorkspaceInput,
} from "./types";

type DbClient = SupabaseClient;
type ResolvedEvallerContext = {
  organizationId: string;
  actor: {
    id: string;
    email?: string;
  };
  membershipRole: EvallerWorkspace["membershipRole"];
  members: EvallerWorkspace["members"];
  invitations: EvallerWorkspace["invitations"];
};

export function createSupabaseEvallerStore(): EvallerStore {
  return new SupabaseEvallerStore(createSupabaseAdminClient());
}

class SupabaseEvallerStore implements EvallerStore {
  constructor(private readonly db: DbClient) {}

  async getWorkspace(actor: EvallerActor) {
    const context = await this.ensureWorkspace(actor);
    return this.loadWorkspace(context);
  }

  async saveWorkspace(actor: EvallerActor, input: EvallerWorkspaceInput) {
    const context = await this.ensureWorkspace(actor);
    await this.persistWorkspaceInput(context, input);
    return this.loadWorkspace(context);
  }

  async runTest(actor: EvallerActor, input: EvallerWorkspaceInput) {
    const context = await this.ensureWorkspace(actor);
    await this.persistWorkspaceInput(context, input);
    const workspace = await this.loadWorkspace(context);
    const validation = validateRunnableWorkspace(workspace);
    if (!validation.ok) {
      throw new ApiError(400, validation.issues.join(" "), "invalid_ai_test");
    }

    const previousRun = workspace.runs[0];
    const now = new Date().toISOString();
    const runId = makeId("run");
    const runningRun: EvallerRunSummary = {
      id: runId,
      aiTestId: workspace.aiTest.id,
      organizationId: context.organizationId,
      promptVersionId: workspace.activePrompt.id,
      promptVersionLabel: workspace.activePrompt.label,
      status: "running",
      qualityBar: workspace.aiTest.qualityBar,
      passRate: 0,
      averageScore: 0,
      totalScenarios: workspace.scenarios.length,
      failedScenarios: 0,
      previousRunId: previousRun?.id,
      startedAt: now,
    };
    await checked(this.db.from("ai_test_runs").insert(toRunRow(runningRun)));

    try {
      const artifacts = await runEvallerAiTest({
        aiTestName: workspace.aiTest.name,
        aiTestDescription: workspace.aiTest.description,
        promptVersion: workspace.activePrompt,
        scenarios: workspace.scenarios,
        successCriteria: workspace.successCriteria,
        qualityBar: workspace.aiTest.qualityBar,
        runId,
        aiTestId: workspace.aiTest.id,
        organizationId: context.organizationId,
        now,
        makeId,
      });
      const completedRun = buildRunSummary({
        runId,
        aiTestId: workspace.aiTest.id,
        organizationId: context.organizationId,
        promptVersion: workspace.activePrompt,
        qualityBar: workspace.aiTest.qualityBar,
        results: artifacts.results,
        previousRunId: previousRun?.id,
        now,
      });
      await checked(
        this.db
          .from("ai_test_runs")
          .update(toRunRow(completedRun))
          .eq("organization_id", context.organizationId)
          .eq("id", runId),
      );
      if (artifacts.results.length) {
        await checked(this.db.from("ai_test_scenario_results").insert(artifacts.results.map(toResultRow)));
      }
      if (artifacts.failurePatterns.length) {
        await checked(this.db.from("ai_test_failure_patterns").insert(artifacts.failurePatterns.map(toFailurePatternRow)));
      }
      if (artifacts.promptSuggestions.length) {
        await checked(this.db.from("ai_test_prompt_suggestions").insert(artifacts.promptSuggestions.map(toPromptSuggestionRow)));
      }
      const detail = buildRunDetail(completedRun, artifacts.results, artifacts.failurePatterns, artifacts.promptSuggestions, previousRun);
      const report = buildReadinessReportRecord({
        id: makeId("readiness_report"),
        run: detail,
        now,
      });
      await checked(this.db.from("ai_test_readiness_reports").insert(toReadinessReportRow(report)));
      return buildRunDetail(completedRun, artifacts.results, artifacts.failurePatterns, artifacts.promptSuggestions, previousRun, report, []);
    } catch (error) {
      await checked(
        this.db
          .from("ai_test_runs")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "AI test run failed.",
            completed_at: new Date().toISOString(),
          })
          .eq("organization_id", context.organizationId)
          .eq("id", runId),
      );
      throw error;
    }
  }

  async listRuns(actor: EvallerActor) {
    const context = await this.ensureWorkspace(actor);
    const workspace = await this.loadWorkspace(context);
    return workspace.runs;
  }

  async getRun(actor: EvallerActor, runId: string) {
    const context = await this.ensureWorkspace(actor);
    const run = await this.loadRun(context, runId);
    if (!run) throw new ApiError(404, "AI test run not found.", "run_not_found");
    return run;
  }

  async applyFix(actor: EvallerActor, runId: string, suggestionId: string) {
    const context = await this.ensureWorkspace(actor);
    const workspace = await this.loadWorkspace(context);
    const { data: suggestion } = await checked(
      this.db
        .from("ai_test_prompt_suggestions")
        .select("*")
        .eq("organization_id", context.organizationId)
        .eq("run_id", runId)
        .eq("id", suggestionId)
        .maybeSingle(),
    );
    if (!suggestion) throw new ApiError(404, "Prompt fix not found for this run.", "suggestion_not_found");
    if (suggestion.applied_prompt_version_id) return this.loadWorkspace(context);

    const now = new Date().toISOString();
    const nextVersion = Math.max(...workspace.promptVersions.map((prompt) => prompt.version), 0) + 1;
    const promptVersion: EvallerPromptVersion = {
      id: makeId("prompt"),
      aiTestId: workspace.aiTest.id,
      organizationId: context.organizationId,
      version: nextVersion,
      label: `Prompt v${nextVersion}: ${suggestion.title}`,
      instructions: suggestion.revised_instructions,
      isActive: true,
      sourceSuggestionId: suggestion.id,
      createdAt: now,
    };
    await checked(
      this.db
        .from("ai_test_prompt_versions")
        .update({ is_active: false })
        .eq("organization_id", context.organizationId)
        .eq("ai_test_id", workspace.aiTest.id),
    );
    await checked(this.db.from("ai_test_prompt_versions").insert(toPromptVersionRow(promptVersion)));
    await checked(
      this.db
        .from("ai_tests")
        .update({ active_prompt_version_id: promptVersion.id, updated_at: now })
        .eq("organization_id", context.organizationId)
        .eq("id", workspace.aiTest.id),
    );
    await checked(
      this.db
        .from("ai_test_prompt_suggestions")
        .update({ applied_at: now, applied_prompt_version_id: promptVersion.id })
        .eq("organization_id", context.organizationId)
        .eq("id", suggestion.id),
    );
    return this.loadWorkspace(context);
  }

  async addReviewComment(actor: EvallerActor, runId: string, body: string) {
    const context = await this.ensureWorkspace(actor);
    const run = await this.loadRunSummary(context, runId);
    if (!run) throw new ApiError(404, "AI test run not found.", "run_not_found");
    const report = await this.ensureReadinessReport(context, run);
    const comment: EvallerReviewComment = {
      id: makeId("review_comment"),
      organizationId: context.organizationId,
      aiTestId: run.aiTestId,
      runId,
      reportId: report.id,
      actorUserId: actor.userId,
      body: body.trim(),
      createdAt: new Date().toISOString(),
    };
    await checked(this.db.from("ai_test_review_comments").insert(toReviewCommentRow(comment)));
    return comment;
  }

  async updateReadinessApproval(actor: EvallerActor, runId: string, input: { status: "approved" | "changes_requested"; note?: string }) {
    const context = await this.ensureWorkspace(actor);
    assertCanApprove(context.membershipRole);
    const run = await this.loadRunSummary(context, runId);
    if (!run) throw new ApiError(404, "AI test run not found.", "run_not_found");
    const report = await this.ensureReadinessReport(context, run);
    const now = new Date().toISOString();
    const patch = {
      approval_status: input.status,
      approved_by: actor.userId,
      approved_at: now,
      approval_note: input.note?.trim() || null,
      updated_at: now,
    };
    await checked(
      this.db
        .from("ai_test_readiness_reports")
        .update(patch)
        .eq("organization_id", context.organizationId)
        .eq("id", report.id),
    );
    return {
      ...report,
      approvalStatus: input.status,
      approvedBy: actor.userId,
      approvedAt: now,
      approvalNote: input.note?.trim() || undefined,
      updatedAt: now,
    };
  }

  async trackReadinessReportCopy(actor: EvallerActor, runId: string) {
    const context = await this.ensureWorkspace(actor);
    const run = await this.loadRunSummary(context, runId);
    if (!run) throw new ApiError(404, "AI test run not found.", "run_not_found");
    const report = await this.ensureReadinessReport(context, run);
    const now = new Date().toISOString();
    const nextCopyCount = report.copyCount + 1;
    await checked(
      this.db
        .from("ai_test_readiness_reports")
        .update({ copy_count: nextCopyCount, last_copied_at: now, updated_at: now })
        .eq("organization_id", context.organizationId)
        .eq("id", report.id),
    );
    return {
      ...report,
      copyCount: nextCopyCount,
      lastCopiedAt: now,
      updatedAt: now,
    };
  }

  async restorePromptVersion(actor: EvallerActor, promptVersionId: string) {
    const context = await this.ensureWorkspace(actor);
    const workspace = await this.loadWorkspace(context);
    const source = workspace.promptVersions.find((prompt) => prompt.id === promptVersionId);
    if (!source) throw new ApiError(404, "Prompt version not found.", "prompt_version_not_found");
    const now = new Date().toISOString();
    const nextVersion = Math.max(...workspace.promptVersions.map((prompt) => prompt.version), 0) + 1;
    const promptVersion: EvallerPromptVersion = {
      id: makeId("prompt"),
      aiTestId: workspace.aiTest.id,
      organizationId: context.organizationId,
      version: nextVersion,
      label: `Prompt v${nextVersion}: Restore ${source.label}`,
      instructions: source.instructions,
      isActive: true,
      createdAt: now,
    };
    await checked(
      this.db
        .from("ai_test_prompt_versions")
        .update({ is_active: false })
        .eq("organization_id", context.organizationId)
        .eq("ai_test_id", workspace.aiTest.id),
    );
    await checked(this.db.from("ai_test_prompt_versions").insert(toPromptVersionRow(promptVersion)));
    await checked(
      this.db
        .from("ai_tests")
        .update({ active_prompt_version_id: promptVersion.id, updated_at: now })
        .eq("organization_id", context.organizationId)
        .eq("id", workspace.aiTest.id),
    );
    return this.loadWorkspace(context);
  }

  private async ensureWorkspace(actor: EvallerActor) {
    const evalOpsStore = await getEvalOpsStore();
    const baseWorkspace = await evalOpsStore.ensureWorkspace(actor);
    const organizationId = baseWorkspace.organization.id;
    const now = new Date().toISOString();
    const { data: existingTest } = await checked(
      this.db
        .from("ai_tests")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
    );
    if (!existingTest) {
      const aiTestId = makeId("ai_test");
      const promptVersionId = makeId("prompt");
      const aiTest = buildDefaultAiTest({
        id: aiTestId,
        organizationId,
        ownerUserId: actor.userId,
        promptVersionId,
        now,
      });
      // PostgREST writes are separate transactions, so create the prompt row before linking the active prompt FK.
      await checked(
        this.db.from("ai_tests").insert({
          ...toAiTestRow(aiTest),
          active_prompt_version_id: null,
        }),
      );
      await checked(
        this.db.from("ai_test_prompt_versions").insert(
          toPromptVersionRow({
            id: promptVersionId,
            aiTestId,
            organizationId,
            version: 1,
            label: "Prompt v1",
            instructions: DEFAULT_EVALLER_PROMPT,
            isActive: true,
            createdAt: now,
          }),
        ),
      );
      await checked(
        this.db
          .from("ai_tests")
          .update({ active_prompt_version_id: promptVersionId, updated_at: now })
          .eq("organization_id", organizationId)
          .eq("id", aiTestId),
      );
      await checked(
        this.db.from("ai_test_scenarios").insert(
          DEFAULT_SCENARIOS.map((scenario, index) =>
            toScenarioRow({
              id: makeId("scenario"),
              aiTestId,
              organizationId,
              title: scenario.title,
              message: scenario.message,
              expectedBehavior: scenario.expectedBehavior,
              sortOrder: index,
              createdAt: now,
              updatedAt: now,
            }),
          ),
        ),
      );
      await checked(
        this.db.from("ai_test_success_criteria").insert(
          DEFAULT_SUCCESS_CRITERIA.map((text, index) =>
            toCriterionRow({
              id: makeId("criterion"),
              aiTestId,
              organizationId,
              text,
              sortOrder: index,
              createdAt: now,
              updatedAt: now,
            }),
          ),
        ),
      );
    }
    return {
      organizationId,
      actor: {
        id: actor.userId,
        email: actor.email,
      },
      membershipRole: baseWorkspace.membership.role,
      members: baseWorkspace.members.map((member) => ({
        id: member.id,
        userId: member.userId,
        role: member.role,
        createdAt: member.createdAt,
      })),
      invitations: baseWorkspace.invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      })),
    };
  }

  private async persistWorkspaceInput(context: ResolvedEvallerContext, input: EvallerWorkspaceInput) {
    const workspace = await this.loadWorkspace(context);
    const now = new Date().toISOString();
    await checked(
      this.db
        .from("ai_tests")
        .update({
          name: input.name.trim(),
          description: input.description.trim(),
          quality_bar: input.qualityBar,
          updated_at: now,
        })
        .eq("organization_id", context.organizationId)
        .eq("id", workspace.aiTest.id),
    );
    await checked(
      this.db
        .from("ai_test_prompt_versions")
        .update({ instructions: input.instructions.trim() })
        .eq("organization_id", context.organizationId)
        .eq("id", workspace.activePrompt.id),
    );

    await checked(
      this.db
        .from("ai_test_scenarios")
        .delete()
        .eq("organization_id", context.organizationId)
        .eq("ai_test_id", workspace.aiTest.id),
    );
    if (input.scenarios.length) {
      await checked(
        this.db.from("ai_test_scenarios").insert(
          input.scenarios.map((scenario, index) =>
            toScenarioRow({
              id: scenario.id || makeId("scenario"),
              aiTestId: workspace.aiTest.id,
              organizationId: context.organizationId,
              title: scenario.title.trim() || `User scenario ${index + 1}`,
              message: scenario.message.trim(),
              expectedBehavior: scenario.expectedBehavior?.trim() || "",
              sortOrder: index,
              createdAt: now,
              updatedAt: now,
            }),
          ),
        ),
      );
    }

    await checked(
      this.db
        .from("ai_test_success_criteria")
        .delete()
        .eq("organization_id", context.organizationId)
        .eq("ai_test_id", workspace.aiTest.id),
    );
    if (input.successCriteria.length) {
      await checked(
        this.db.from("ai_test_success_criteria").insert(
          input.successCriteria.map((criterion, index) =>
            toCriterionRow({
              id: criterion.id || makeId("criterion"),
              aiTestId: workspace.aiTest.id,
              organizationId: context.organizationId,
              text: criterion.text.trim(),
              sortOrder: index,
              createdAt: now,
              updatedAt: now,
            }),
          ),
        ),
      );
    }
  }

  private async loadWorkspace(context: ResolvedEvallerContext): Promise<EvallerWorkspace> {
    const { data: aiTestRow } = await checked(
      this.db
        .from("ai_tests")
        .select("*")
        .eq("organization_id", context.organizationId)
        .order("created_at")
        .limit(1)
        .single(),
    );
    const aiTest = mapAiTest(aiTestRow);
    const [{ data: promptRows }, { data: scenarioRows }, { data: criterionRows }, { data: runRows }] = await Promise.all([
      checked(
        this.db
          .from("ai_test_prompt_versions")
          .select("*")
          .eq("organization_id", context.organizationId)
          .eq("ai_test_id", aiTest.id)
          .order("version", { ascending: false }),
      ),
      checked(
        this.db
          .from("ai_test_scenarios")
          .select("*")
          .eq("organization_id", context.organizationId)
          .eq("ai_test_id", aiTest.id)
          .order("sort_order"),
      ),
      checked(
        this.db
          .from("ai_test_success_criteria")
          .select("*")
          .eq("organization_id", context.organizationId)
          .eq("ai_test_id", aiTest.id)
          .order("sort_order"),
      ),
      checked(
        this.db
          .from("ai_test_runs")
          .select("*")
          .eq("organization_id", context.organizationId)
          .eq("ai_test_id", aiTest.id)
          .order("started_at", { ascending: false })
          .limit(30),
      ),
    ]);
    const promptVersions = (promptRows || []).map(mapPromptVersion);
    const activePrompt =
      promptVersions.find((prompt) => prompt.id === aiTest.activePromptVersionId) ||
      promptVersions.find((prompt) => prompt.isActive) ||
      promptVersions[0];
    const runs = (runRows || []).map(mapRun);
    const latestRun = runs[0] ? await this.loadRun(context, runs[0].id) : undefined;
    return {
      user: context.actor,
      aiTest,
      activePrompt,
      promptVersions,
      scenarios: (scenarioRows || []).map(mapScenario),
      successCriteria: (criterionRows || []).map(mapCriterion),
      runs,
      membershipRole: context.membershipRole,
      members: context.members,
      invitations: context.invitations,
      latestRun,
    };
  }

  private async loadRunSummary(context: { organizationId: string }, runId: string) {
    const { data: runRow } = await checked(
      this.db
        .from("ai_test_runs")
        .select("*")
        .eq("organization_id", context.organizationId)
        .eq("id", runId)
        .maybeSingle(),
    );
    return runRow ? mapRun(runRow) : undefined;
  }

  private async loadRun(context: { organizationId: string }, runId: string): Promise<EvallerRunDetail | undefined> {
    const run = await this.loadRunSummary(context, runId);
    if (!run) return undefined;
    const [{ data: resultRows }, { data: patternRows }, { data: suggestionRows }, { data: reportRow }, { data: commentRows }, { data: previousRunRow }] = await Promise.all([
      checked(this.db.from("ai_test_scenario_results").select("*").eq("organization_id", context.organizationId).eq("run_id", run.id)),
      checked(this.db.from("ai_test_failure_patterns").select("*").eq("organization_id", context.organizationId).eq("run_id", run.id)),
      checked(this.db.from("ai_test_prompt_suggestions").select("*").eq("organization_id", context.organizationId).eq("run_id", run.id)),
      checked(this.db.from("ai_test_readiness_reports").select("*").eq("organization_id", context.organizationId).eq("run_id", run.id).maybeSingle()),
      checked(this.db.from("ai_test_review_comments").select("*").eq("organization_id", context.organizationId).eq("run_id", run.id).order("created_at", { ascending: false })),
      run.previousRunId
        ? checked(
            this.db
              .from("ai_test_runs")
              .select("*")
              .eq("organization_id", context.organizationId)
              .eq("id", run.previousRunId)
              .maybeSingle(),
          )
        : Promise.resolve({ data: undefined }),
    ]);
    const results = (resultRows || []).map(mapResult);
    const failurePatterns = (patternRows || []).map(mapFailurePattern);
    const promptSuggestions = (suggestionRows || []).map(mapPromptSuggestion);
    const previousRun = previousRunRow ? mapRun(previousRunRow) : undefined;
    const readinessReport = reportRow
      ? mapReadinessReport(reportRow)
      : buildReadinessReportRecord({
          id: makeId("readiness_report"),
          run: buildRunDetail(run, results, failurePatterns, promptSuggestions, previousRun),
          now: run.completedAt || run.startedAt,
        });
    return buildRunDetail(
      run,
      results,
      failurePatterns,
      promptSuggestions,
      previousRun,
      readinessReport,
      (commentRows || []).map(mapReviewComment),
    );
  }

  private async ensureReadinessReport(context: { organizationId: string }, run: EvallerRunSummary) {
    const { data: reportRow } = await checked(
      this.db
        .from("ai_test_readiness_reports")
        .select("*")
        .eq("organization_id", context.organizationId)
        .eq("run_id", run.id)
        .maybeSingle(),
    );
    if (reportRow) return mapReadinessReport(reportRow);
    const runDetail = await this.loadRun(context, run.id);
    if (!runDetail?.readinessReport) throw new ApiError(404, "AI test run not found.", "run_not_found");
    await checked(this.db.from("ai_test_readiness_reports").insert(toReadinessReportRow(runDetail.readinessReport)));
    return runDetail.readinessReport;
  }
}

function mapAiTest(row: any): EvallerAiTest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    description: row.description || "",
    qualityBar: Number(row.quality_bar),
    activePromptVersionId: row.active_prompt_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPromptVersion(row: any): EvallerPromptVersion {
  return {
    id: row.id,
    aiTestId: row.ai_test_id,
    organizationId: row.organization_id,
    version: Number(row.version),
    label: row.label,
    instructions: row.instructions,
    isActive: Boolean(row.is_active),
    sourceSuggestionId: row.source_suggestion_id || undefined,
    createdAt: row.created_at,
  };
}

function mapScenario(row: any): EvallerScenario {
  return {
    id: row.id,
    aiTestId: row.ai_test_id,
    organizationId: row.organization_id,
    title: row.title,
    message: row.message,
    expectedBehavior: row.expected_behavior || "",
    sortOrder: Number(row.sort_order),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCriterion(row: any): EvallerSuccessCriterion {
  return {
    id: row.id,
    aiTestId: row.ai_test_id,
    organizationId: row.organization_id,
    text: row.text,
    sortOrder: Number(row.sort_order),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRun(row: any): EvallerRunSummary {
  return {
    id: row.id,
    aiTestId: row.ai_test_id,
    organizationId: row.organization_id,
    promptVersionId: row.prompt_version_id,
    promptVersionLabel: row.prompt_version_label,
    status: row.status,
    qualityBar: Number(row.quality_bar),
    passRate: Number(row.pass_rate),
    averageScore: Number(row.average_score),
    totalScenarios: Number(row.total_scenarios),
    failedScenarios: Number(row.failed_scenarios),
    previousRunId: row.previous_run_id || undefined,
    startedAt: row.started_at,
    completedAt: row.completed_at || undefined,
    errorMessage: row.error_message || undefined,
  };
}

function mapResult(row: any): EvallerScenarioResult {
  return {
    id: row.id,
    runId: row.run_id,
    scenarioId: row.scenario_id || undefined,
    organizationId: row.organization_id,
    aiTestId: row.ai_test_id,
    scenarioTitle: row.scenario_title,
    scenarioMessage: row.scenario_message,
    assistantResponse: row.assistant_response,
    score: Number(row.score),
    status: row.status,
    passedCriteria: row.passed_criteria || [],
    failedCriteria: row.failed_criteria || [],
    rationale: row.rationale,
    createdAt: row.created_at,
  };
}

function mapFailurePattern(row: any): EvallerFailurePattern {
  return {
    id: row.id,
    runId: row.run_id,
    organizationId: row.organization_id,
    aiTestId: row.ai_test_id,
    title: row.title,
    description: row.description,
    failedCriteria: row.failed_criteria || [],
    scenarioIds: row.scenario_ids || [],
    severity: row.severity,
    createdAt: row.created_at,
  };
}

function mapPromptSuggestion(row: any): EvallerPromptSuggestion {
  return {
    id: row.id,
    runId: row.run_id,
    organizationId: row.organization_id,
    aiTestId: row.ai_test_id,
    title: row.title,
    explanation: row.explanation,
    patch: row.patch,
    revisedInstructions: row.revised_instructions,
    affectedCriteria: row.affected_criteria || [],
    appliedAt: row.applied_at || undefined,
    appliedPromptVersionId: row.applied_prompt_version_id || undefined,
    createdAt: row.created_at,
  };
}

function mapReadinessReport(row: any): EvallerReadinessReportRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    aiTestId: row.ai_test_id,
    runId: row.run_id,
    status: row.status,
    approvalStatus: row.approval_status,
    summary: row.summary,
    beforePassRate: row.before_pass_rate === null || row.before_pass_rate === undefined ? undefined : Number(row.before_pass_rate),
    afterPassRate: Number(row.after_pass_rate),
    appliedPromptChange: row.applied_prompt_change,
    remainingRisks: row.remaining_risks || [],
    recommendedNextStep: row.recommended_next_step,
    copyText: row.copy_text,
    approvedBy: row.approved_by || undefined,
    approvedAt: row.approved_at || undefined,
    approvalNote: row.approval_note || undefined,
    copyCount: Number(row.copy_count || 0),
    lastCopiedAt: row.last_copied_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReviewComment(row: any): EvallerReviewComment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    aiTestId: row.ai_test_id,
    runId: row.run_id,
    reportId: row.report_id || undefined,
    actorUserId: row.actor_user_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

function toAiTestRow(aiTest: EvallerAiTest) {
  return {
    id: aiTest.id,
    organization_id: aiTest.organizationId,
    owner_user_id: aiTest.ownerUserId,
    name: aiTest.name,
    description: aiTest.description,
    quality_bar: aiTest.qualityBar,
    active_prompt_version_id: aiTest.activePromptVersionId,
    created_at: aiTest.createdAt,
    updated_at: aiTest.updatedAt,
  };
}

function toPromptVersionRow(prompt: EvallerPromptVersion) {
  return {
    id: prompt.id,
    ai_test_id: prompt.aiTestId,
    organization_id: prompt.organizationId,
    version: prompt.version,
    label: prompt.label,
    instructions: prompt.instructions,
    is_active: prompt.isActive,
    source_suggestion_id: prompt.sourceSuggestionId,
    created_at: prompt.createdAt,
  };
}

function toScenarioRow(scenario: EvallerScenario) {
  return {
    id: scenario.id,
    ai_test_id: scenario.aiTestId,
    organization_id: scenario.organizationId,
    title: scenario.title,
    message: scenario.message,
    expected_behavior: scenario.expectedBehavior,
    sort_order: scenario.sortOrder,
    created_at: scenario.createdAt,
    updated_at: scenario.updatedAt,
  };
}

function toCriterionRow(criterion: EvallerSuccessCriterion) {
  return {
    id: criterion.id,
    ai_test_id: criterion.aiTestId,
    organization_id: criterion.organizationId,
    text: criterion.text,
    sort_order: criterion.sortOrder,
    created_at: criterion.createdAt,
    updated_at: criterion.updatedAt,
  };
}

function toRunRow(run: EvallerRunSummary) {
  return {
    id: run.id,
    ai_test_id: run.aiTestId,
    organization_id: run.organizationId,
    prompt_version_id: run.promptVersionId,
    prompt_version_label: run.promptVersionLabel,
    status: run.status,
    quality_bar: run.qualityBar,
    pass_rate: run.passRate,
    average_score: run.averageScore,
    total_scenarios: run.totalScenarios,
    failed_scenarios: run.failedScenarios,
    previous_run_id: run.previousRunId,
    started_at: run.startedAt,
    completed_at: run.completedAt,
    error_message: run.errorMessage,
  };
}

function toResultRow(result: EvallerScenarioResult) {
  return {
    id: result.id,
    run_id: result.runId,
    scenario_id: result.scenarioId,
    organization_id: result.organizationId,
    ai_test_id: result.aiTestId,
    scenario_title: result.scenarioTitle,
    scenario_message: result.scenarioMessage,
    assistant_response: result.assistantResponse,
    score: result.score,
    status: result.status,
    passed_criteria: result.passedCriteria,
    failed_criteria: result.failedCriteria,
    rationale: result.rationale,
    created_at: result.createdAt,
  };
}

function toFailurePatternRow(pattern: EvallerFailurePattern) {
  return {
    id: pattern.id,
    run_id: pattern.runId,
    organization_id: pattern.organizationId,
    ai_test_id: pattern.aiTestId,
    title: pattern.title,
    description: pattern.description,
    failed_criteria: pattern.failedCriteria,
    scenario_ids: pattern.scenarioIds,
    severity: pattern.severity,
    created_at: pattern.createdAt,
  };
}

function toPromptSuggestionRow(suggestion: EvallerPromptSuggestion) {
  return {
    id: suggestion.id,
    run_id: suggestion.runId,
    organization_id: suggestion.organizationId,
    ai_test_id: suggestion.aiTestId,
    title: suggestion.title,
    explanation: suggestion.explanation,
    patch: suggestion.patch,
    revised_instructions: suggestion.revisedInstructions,
    affected_criteria: suggestion.affectedCriteria,
    applied_at: suggestion.appliedAt,
    applied_prompt_version_id: suggestion.appliedPromptVersionId,
    created_at: suggestion.createdAt,
  };
}

function toReadinessReportRow(report: EvallerReadinessReportRecord) {
  return {
    id: report.id,
    organization_id: report.organizationId,
    ai_test_id: report.aiTestId,
    run_id: report.runId,
    status: report.status,
    approval_status: report.approvalStatus,
    summary: report.summary,
    before_pass_rate: report.beforePassRate,
    after_pass_rate: report.afterPassRate,
    applied_prompt_change: report.appliedPromptChange,
    remaining_risks: report.remainingRisks,
    recommended_next_step: report.recommendedNextStep,
    copy_text: report.copyText,
    approved_by: report.approvedBy,
    approved_at: report.approvedAt,
    approval_note: report.approvalNote,
    copy_count: report.copyCount,
    last_copied_at: report.lastCopiedAt,
    created_at: report.createdAt,
    updated_at: report.updatedAt,
  };
}

function toReviewCommentRow(comment: EvallerReviewComment) {
  return {
    id: comment.id,
    organization_id: comment.organizationId,
    ai_test_id: comment.aiTestId,
    run_id: comment.runId,
    report_id: comment.reportId,
    actor_user_id: comment.actorUserId,
    body: comment.body,
    created_at: comment.createdAt,
  };
}

function assertCanApprove(role: EvallerWorkspace["membershipRole"]) {
  if (role !== "owner" && role !== "admin") {
    throw new ApiError(403, "Your role does not allow approving release readiness reports.", "forbidden");
  }
}

async function checked<T>(promise: PromiseLike<{ data: T; error: any }>) {
  const result = await promise;
  if (result.error) {
    throw new Error(result.error.message || "Supabase request failed.");
  }
  return result;
}

function makeId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}
