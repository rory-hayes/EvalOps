import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/server/auth";
import type { EvallerWorkspace } from "./types";

let tempDir = "";

beforeEach(async () => {
  vi.resetModules();
  tempDir = await mkdtemp(join(tmpdir(), "evaller-store-"));
  process.env.EVALOPS_TEST_MODE = "1";
  process.env.EVALOPS_TEST_STORE_PATH = tempDir;
});

afterEach(async () => {
  vi.doUnmock("./ai");
  vi.resetModules();
  delete process.env.EVALOPS_TEST_MODE;
  delete process.env.EVALOPS_TEST_STORE_PATH;
  await rm(tempDir, { recursive: true, force: true });
});

describe("LocalEvallerStore failed live runs", () => {
  it("persists failed system runs without deriving readiness reports", async () => {
    vi.doMock("./ai", () => ({
      runEvallerAiTest: vi.fn(async () => {
        throw new ApiError(
          502,
          "The AI test run failed while calling OpenAI. Please try again.",
          "openai_run_failed",
        );
      }),
    }));
    const { createLocalEvallerStore } = await import("./local-store");
    const store = createLocalEvallerStore({ rootDir: tempDir });
    const actor = {
      userId: "user_failed_run",
      email: "failed-run@example.test",
      organizationId: "org_failed_run",
    };
    const workspace = await store.getWorkspace(actor);

    await expect(store.runTest(actor, workspaceToInput(workspace))).rejects.toMatchObject({
      code: "openai_run_failed",
    });

    const runs = await store.listRuns(actor);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      status: "failed",
      passRate: 0,
      averageScore: 0,
      failedScenarios: 0,
      totalScenarios: 3,
      errorMessage: "The AI test run failed while calling OpenAI. Please try again.",
    });

    const failedRun = await store.getRun(actor, runs[0].id);
    expect(failedRun.status).toBe("failed");
    expect(failedRun.results).toEqual([]);
    expect(failedRun.failurePatterns).toEqual([]);
    expect(failedRun.promptSuggestions).toEqual([]);
    expect(failedRun.readinessReport).toBeUndefined();

    await expect(store.trackReadinessReportCopy(actor, failedRun.id)).rejects.toMatchObject({
      code: "readiness_report_unavailable",
    });
    await expect(
      store.updateReadinessApproval(actor, failedRun.id, { status: "approved" }),
    ).rejects.toMatchObject({
      code: "readiness_report_unavailable",
    });
  });
});

function workspaceToInput(workspace: EvallerWorkspace) {
  return {
    name: workspace.aiTest.name,
    description: workspace.aiTest.description,
    instructions: workspace.activePrompt.instructions,
    qualityBar: workspace.aiTest.qualityBar,
    scenarios: workspace.scenarios.map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      message: scenario.message,
      expectedBehavior: scenario.expectedBehavior,
    })),
    successCriteria: workspace.successCriteria.map((criterion) => ({
      id: criterion.id,
      text: criterion.text,
    })),
  };
}
