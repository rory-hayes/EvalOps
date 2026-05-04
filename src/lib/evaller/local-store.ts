import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ApiError } from "@/lib/server/auth";
import { getEvalOpsStore } from "@/lib/server/store";
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

type LocalWorkspaceRecords = {
  aiTest: EvallerAiTest;
  promptVersions: EvallerPromptVersion[];
  scenarios: EvallerScenario[];
  successCriteria: EvallerSuccessCriterion[];
  runs: EvallerRunSummary[];
  results: EvallerScenarioResult[];
  failurePatterns: EvallerRunDetail["failurePatterns"];
  promptSuggestions: EvallerPromptSuggestion[];
  readinessReports: EvallerReadinessReportRecord[];
  reviewComments: EvallerReviewComment[];
};

type LocalEvallerState = {
  workspaces: Record<string, LocalWorkspaceRecords>;
};

export function createLocalEvallerStore(options: { rootDir: string }): EvallerStore {
  return new LocalEvallerStore(join(options.rootDir, "evaller-state.json"));
}

class LocalEvallerStore implements EvallerStore {
  constructor(private readonly filePath: string) {}

  async getWorkspace(actor: EvallerActor) {
    const state = await this.load();
    const records = this.ensureRecords(state, actor);
    await this.save(state);
    return this.toWorkspace(actor, records, await resolveWorkspaceContext(actor));
  }

  async saveWorkspace(actor: EvallerActor, input: EvallerWorkspaceInput) {
    const state = await this.load();
    const records = this.ensureRecords(state, actor);
    applyWorkspaceInput(records, input, actor, makeId);
    await this.save(state);
    return this.toWorkspace(actor, records, await resolveWorkspaceContext(actor));
  }

  async runTest(actor: EvallerActor, input: EvallerWorkspaceInput, options: { correlationId?: string } = {}) {
    const state = await this.load();
    const records = this.ensureRecords(state, actor);
    const context = await resolveWorkspaceContext(actor);
    applyWorkspaceInput(records, input, actor, makeId);
    const workspace = this.toWorkspace(actor, records, context);
    const validation = validateRunnableWorkspace(workspace);
    if (!validation.ok) {
      throw new ApiError(400, validation.issues.join(" "), "invalid_ai_test");
    }

    const previousRun = records.runs[0];
    const now = new Date().toISOString();
    const runId = makeId("run");
    const runShell: EvallerRunSummary = {
      id: runId,
      aiTestId: records.aiTest.id,
      organizationId: records.aiTest.organizationId,
      promptVersionId: workspace.activePrompt.id,
      promptVersionLabel: workspace.activePrompt.label,
      status: "running",
      qualityBar: records.aiTest.qualityBar,
      passRate: 0,
      averageScore: 0,
      totalScenarios: records.scenarios.length,
      failedScenarios: 0,
      previousRunId: previousRun?.id,
      startedAt: now,
    };
    records.runs.unshift(runShell);

    try {
      const artifacts = await runEvallerAiTest({
        aiTestName: records.aiTest.name,
        aiTestDescription: records.aiTest.description,
        promptVersion: workspace.activePrompt,
        scenarios: records.scenarios,
        successCriteria: records.successCriteria,
        qualityBar: records.aiTest.qualityBar,
        runId,
        aiTestId: records.aiTest.id,
        organizationId: records.aiTest.organizationId,
        now,
        makeId,
        correlationId: options.correlationId,
      });
      const completedRun = buildRunSummary({
        runId,
        aiTestId: records.aiTest.id,
        organizationId: records.aiTest.organizationId,
        promptVersion: workspace.activePrompt,
        qualityBar: records.aiTest.qualityBar,
        results: artifacts.results,
        previousRunId: previousRun?.id,
        now,
      });
      records.runs = [completedRun, ...records.runs.filter((run) => run.id !== runId)];
      records.results = [...artifacts.results, ...records.results];
      records.failurePatterns = [...artifacts.failurePatterns, ...records.failurePatterns];
      records.promptSuggestions = [...artifacts.promptSuggestions, ...records.promptSuggestions];
      const detail = buildRunDetail(completedRun, artifacts.results, artifacts.failurePatterns, artifacts.promptSuggestions, previousRun);
      const report = buildReadinessReportRecord({
        id: makeId("readiness_report"),
        run: detail,
        now,
      });
      records.readinessReports = [report, ...records.readinessReports];
      await this.save(state);
      return buildRunDetail(completedRun, artifacts.results, artifacts.failurePatterns, artifacts.promptSuggestions, previousRun, report, []);
    } catch (error) {
      runShell.status = "failed";
      runShell.errorMessage = runFailureMessage(error, options.correlationId);
      runShell.completedAt = new Date().toISOString();
      await this.save(state);
      throw error;
    }
  }

  async listRuns(actor: EvallerActor) {
    const workspace = await this.getWorkspace(actor);
    return workspace.runs;
  }

  async getRun(actor: EvallerActor, runId: string) {
    const state = await this.load();
    const records = this.ensureRecords(state, actor);
    const run = records.runs.find((item) => item.id === runId);
    if (!run) throw new ApiError(404, "AI test run not found.", "run_not_found");
    return this.toRunDetail(records, run);
  }

  async applyFix(actor: EvallerActor, runId: string, suggestionId: string) {
    const state = await this.load();
    const records = this.ensureRecords(state, actor);
    const suggestion = records.promptSuggestions.find(
      (item) => item.runId === runId && item.id === suggestionId,
    );
    if (!suggestion) throw new ApiError(404, "Prompt fix not found for this run.", "suggestion_not_found");

    if (suggestion.appliedPromptVersionId) {
      await this.save(state);
      return this.toWorkspace(actor, records, await resolveWorkspaceContext(actor));
    }

    const now = new Date().toISOString();
    records.promptVersions.forEach((prompt) => {
      prompt.isActive = false;
    });
    const nextVersion = Math.max(...records.promptVersions.map((prompt) => prompt.version), 0) + 1;
    const promptVersion: EvallerPromptVersion = {
      id: makeId("prompt"),
      aiTestId: records.aiTest.id,
      organizationId: records.aiTest.organizationId,
      version: nextVersion,
      label: `Prompt v${nextVersion}: ${suggestion.title}`,
      instructions: suggestion.revisedInstructions,
      isActive: true,
      sourceSuggestionId: suggestion.id,
      createdAt: now,
    };
    records.promptVersions.unshift(promptVersion);
    records.aiTest.activePromptVersionId = promptVersion.id;
    records.aiTest.updatedAt = now;
    suggestion.appliedAt = now;
    suggestion.appliedPromptVersionId = promptVersion.id;
    await this.save(state);
    return this.toWorkspace(actor, records, await resolveWorkspaceContext(actor));
  }

  async addReviewComment(actor: EvallerActor, runId: string, body: string) {
    const state = await this.load();
    const records = this.ensureRecords(state, actor);
    const run = records.runs.find((item) => item.id === runId);
    if (!run) throw new ApiError(404, "AI test run not found.", "run_not_found");
    const report = this.ensureReadinessReport(records, run);
    const comment: EvallerReviewComment = {
      id: makeId("review_comment"),
      organizationId: records.aiTest.organizationId,
      aiTestId: records.aiTest.id,
      runId,
      reportId: report.id,
      actorUserId: actor.userId,
      body: body.trim(),
      createdAt: new Date().toISOString(),
    };
    records.reviewComments.unshift(comment);
    await this.save(state);
    return comment;
  }

  async updateReadinessApproval(actor: EvallerActor, runId: string, input: { status: "approved" | "changes_requested"; note?: string }) {
    const context = await resolveWorkspaceContext(actor);
    assertCanApprove(context.membershipRole);
    const state = await this.load();
    const records = this.ensureRecords(state, actor);
    const run = records.runs.find((item) => item.id === runId);
    if (!run) throw new ApiError(404, "AI test run not found.", "run_not_found");
    const report = this.ensureReadinessReport(records, run);
    const now = new Date().toISOString();
    report.approvalStatus = input.status;
    report.approvedBy = actor.userId;
    report.approvedAt = now;
    report.approvalNote = input.note?.trim() || undefined;
    report.updatedAt = now;
    await this.save(state);
    return report;
  }

  async trackReadinessReportCopy(actor: EvallerActor, runId: string) {
    const state = await this.load();
    const records = this.ensureRecords(state, actor);
    const run = records.runs.find((item) => item.id === runId);
    if (!run) throw new ApiError(404, "AI test run not found.", "run_not_found");
    const report = this.ensureReadinessReport(records, run);
    const now = new Date().toISOString();
    report.copyCount += 1;
    report.lastCopiedAt = now;
    report.updatedAt = now;
    await this.save(state);
    return report;
  }

  async restorePromptVersion(actor: EvallerActor, promptVersionId: string) {
    const state = await this.load();
    const records = this.ensureRecords(state, actor);
    const source = records.promptVersions.find((prompt) => prompt.id === promptVersionId);
    if (!source) throw new ApiError(404, "Prompt version not found.", "prompt_version_not_found");
    const now = new Date().toISOString();
    records.promptVersions.forEach((prompt) => {
      prompt.isActive = false;
    });
    const nextVersion = Math.max(...records.promptVersions.map((prompt) => prompt.version), 0) + 1;
    const promptVersion: EvallerPromptVersion = {
      id: makeId("prompt"),
      aiTestId: records.aiTest.id,
      organizationId: records.aiTest.organizationId,
      version: nextVersion,
      label: `Prompt v${nextVersion}: Restore ${source.label}`,
      instructions: source.instructions,
      isActive: true,
      createdAt: now,
    };
    records.promptVersions.unshift(promptVersion);
    records.aiTest.activePromptVersionId = promptVersion.id;
    records.aiTest.updatedAt = now;
    await this.save(state);
    return this.toWorkspace(actor, records, await resolveWorkspaceContext(actor));
  }

  private toWorkspace(actor: EvallerActor, records: LocalWorkspaceRecords, context: EvallerWorkspaceContext): EvallerWorkspace {
    const activePrompt =
      records.promptVersions.find((prompt) => prompt.id === records.aiTest.activePromptVersionId) ||
      records.promptVersions.find((prompt) => prompt.isActive) ||
      records.promptVersions[0];
    const latestRun = records.runs[0] ? this.toRunDetail(records, records.runs[0]) : undefined;

    return {
      user: {
        id: actor.userId,
        email: actor.email,
      },
      aiTest: records.aiTest,
      activePrompt,
      promptVersions: records.promptVersions,
      scenarios: [...records.scenarios].sort((a, b) => a.sortOrder - b.sortOrder),
      successCriteria: [...records.successCriteria].sort((a, b) => a.sortOrder - b.sortOrder),
      runs: records.runs,
      membershipRole: context.membershipRole,
      members: context.members,
      invitations: context.invitations,
      latestRun,
    };
  }

  private toRunDetail(records: LocalWorkspaceRecords, run: EvallerRunSummary) {
    return buildRunDetail(
      run,
      records.results.filter((result) => result.runId === run.id),
      records.failurePatterns.filter((pattern) => pattern.runId === run.id),
      records.promptSuggestions.filter((suggestion) => suggestion.runId === run.id),
      run.previousRunId ? records.runs.find((item) => item.id === run.previousRunId) : undefined,
      run.status === "completed"
        ? records.readinessReports.find((report) => report.runId === run.id) || this.buildDerivedReadinessReport(records, run)
        : undefined,
      records.reviewComments.filter((comment) => comment.runId === run.id),
    );
  }

  private ensureReadinessReport(records: LocalWorkspaceRecords, run: EvallerRunSummary) {
    if (run.status !== "completed") {
      throw new ApiError(
        409,
        "A readiness report is only available after a completed AI test run.",
        "readiness_report_unavailable",
      );
    }
    const existing = records.readinessReports.find((report) => report.runId === run.id);
    if (existing) return existing;
    const report = this.buildDerivedReadinessReport(records, run);
    records.readinessReports.unshift(report);
    return report;
  }

  private buildDerivedReadinessReport(records: LocalWorkspaceRecords, run: EvallerRunSummary) {
    if (run.status !== "completed") {
      throw new ApiError(
        409,
        "A readiness report is only available after a completed AI test run.",
        "readiness_report_unavailable",
      );
    }
    return buildReadinessReportRecord({
      id: makeId("readiness_report"),
      run: buildRunDetail(
        run,
        records.results.filter((result) => result.runId === run.id),
        records.failurePatterns.filter((pattern) => pattern.runId === run.id),
        records.promptSuggestions.filter((suggestion) => suggestion.runId === run.id),
        run.previousRunId ? records.runs.find((item) => item.id === run.previousRunId) : undefined,
      ),
      now: run.completedAt || run.startedAt,
    });
  }

  private ensureRecords(state: LocalEvallerState, actor: EvallerActor) {
    const key = workspaceKey(actor);
    if (!state.workspaces[key]) {
      const now = new Date().toISOString();
      const organizationId = actor.organizationId || `org_${actor.userId}`;
      const aiTestId = makeId("ai_test");
      const promptVersionId = makeId("prompt");
      const aiTest = buildDefaultAiTest({
        id: aiTestId,
        organizationId,
        ownerUserId: actor.userId,
        promptVersionId,
        now,
      });
      state.workspaces[key] = {
        aiTest,
        promptVersions: [
          {
            id: promptVersionId,
            aiTestId,
            organizationId,
            version: 1,
            label: "Prompt v1",
            instructions: DEFAULT_EVALLER_PROMPT,
            isActive: true,
            createdAt: now,
          },
        ],
        scenarios: DEFAULT_SCENARIOS.map((scenario, index) => ({
          id: makeId("scenario"),
          aiTestId,
          organizationId,
          title: scenario.title,
          message: scenario.message,
          expectedBehavior: scenario.expectedBehavior,
          sortOrder: index,
          createdAt: now,
          updatedAt: now,
        })),
        successCriteria: DEFAULT_SUCCESS_CRITERIA.map((text, index) => ({
          id: makeId("criterion"),
          aiTestId,
          organizationId,
          text,
          sortOrder: index,
          createdAt: now,
          updatedAt: now,
        })),
        runs: [],
        results: [],
        failurePatterns: [],
        promptSuggestions: [],
        readinessReports: [],
        reviewComments: [],
      };
    }
    state.workspaces[key].readinessReports ||= [];
    state.workspaces[key].reviewComments ||= [];
    return state.workspaces[key];
  }

  private async load(): Promise<LocalEvallerState> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as LocalEvallerState;
    } catch {
      return { workspaces: {} };
    }
  }

  private async save(state: LocalEvallerState) {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(state, null, 2));
  }
}

function runFailureMessage(error: unknown, correlationId?: string) {
  const message = error instanceof Error ? error.message : "AI test run failed.";
  return correlationId ? `${message} Reference: ${correlationId}.` : message;
}

export function applyWorkspaceInput(
  records: LocalWorkspaceRecords,
  input: EvallerWorkspaceInput,
  actor: EvallerActor,
  makeIdFn: (prefix: string) => string,
) {
  const now = new Date().toISOString();
  records.aiTest.name = input.name.trim();
  records.aiTest.description = input.description.trim();
  records.aiTest.qualityBar = input.qualityBar;
  records.aiTest.updatedAt = now;

  const activePrompt = records.promptVersions.find((prompt) => prompt.id === records.aiTest.activePromptVersionId) ||
    records.promptVersions.find((prompt) => prompt.isActive) ||
    records.promptVersions[0];
  activePrompt.instructions = input.instructions.trim();

  records.scenarios = input.scenarios.map((scenario, index) => ({
    id: scenario.id || makeIdFn("scenario"),
    aiTestId: records.aiTest.id,
    organizationId: records.aiTest.organizationId,
    title: scenario.title.trim() || `User scenario ${index + 1}`,
    message: scenario.message.trim(),
    expectedBehavior: scenario.expectedBehavior?.trim() || "",
    sortOrder: index,
    createdAt: records.scenarios.find((item) => item.id === scenario.id)?.createdAt || now,
    updatedAt: now,
  }));

  records.successCriteria = input.successCriteria.map((criterion, index) => ({
    id: criterion.id || makeIdFn("criterion"),
    aiTestId: records.aiTest.id,
    organizationId: records.aiTest.organizationId,
    text: criterion.text.trim(),
    sortOrder: index,
    createdAt: records.successCriteria.find((item) => item.id === criterion.id)?.createdAt || now,
    updatedAt: now,
  }));

  if (!records.aiTest.ownerUserId) records.aiTest.ownerUserId = actor.userId;
}

function workspaceKey(actor: EvallerActor) {
  return actor.organizationId || `org_${actor.userId}`;
}

type EvallerWorkspaceContext = {
  membershipRole: EvallerWorkspace["membershipRole"];
  members: EvallerWorkspace["members"];
  invitations: EvallerWorkspace["invitations"];
};

async function resolveWorkspaceContext(actor: EvallerActor): Promise<EvallerWorkspaceContext> {
  const store = await getEvalOpsStore();
  const workspace = await store.ensureWorkspace(actor);
  return {
    membershipRole: workspace.membership.role,
    members: workspace.members.map((member) => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
    })),
    invitations: workspace.invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    })),
  };
}

function assertCanApprove(role: EvallerWorkspace["membershipRole"]) {
  if (role !== "owner" && role !== "admin") {
    throw new ApiError(403, "Your role does not allow approving release readiness reports.", "forbidden");
  }
}

function makeId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}
