import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ApiError } from "@/lib/server/auth";
import { runEvallerAiTest } from "./ai";
import {
  DEFAULT_EVALLER_PROMPT,
  DEFAULT_SCENARIOS,
  DEFAULT_SUCCESS_CRITERIA,
  buildDefaultAiTest,
  buildRunDetail,
  buildRunSummary,
} from "./logic";
import { validateRunnableWorkspace } from "./schemas";
import type {
  EvallerActor,
  EvallerAiTest,
  EvallerPromptSuggestion,
  EvallerPromptVersion,
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
    return this.toWorkspace(actor, records);
  }

  async saveWorkspace(actor: EvallerActor, input: EvallerWorkspaceInput) {
    const state = await this.load();
    const records = this.ensureRecords(state, actor);
    applyWorkspaceInput(records, input, actor, makeId);
    await this.save(state);
    return this.toWorkspace(actor, records);
  }

  async runTest(actor: EvallerActor, input: EvallerWorkspaceInput) {
    const state = await this.load();
    const records = this.ensureRecords(state, actor);
    applyWorkspaceInput(records, input, actor, makeId);
    const workspace = this.toWorkspace(actor, records);
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
      await this.save(state);
      return buildRunDetail(completedRun, artifacts.results, artifacts.failurePatterns, artifacts.promptSuggestions, previousRun);
    } catch (error) {
      runShell.status = "failed";
      runShell.errorMessage = error instanceof Error ? error.message : "AI test run failed.";
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
      return this.toWorkspace(actor, records);
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
    return this.toWorkspace(actor, records);
  }

  private toWorkspace(actor: EvallerActor, records: LocalWorkspaceRecords): EvallerWorkspace {
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
    );
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
      };
    }
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

function makeId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}
