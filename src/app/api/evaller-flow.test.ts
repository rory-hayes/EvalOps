import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let tempDir = "";

beforeEach(async () => {
  vi.resetModules();
  tempDir = await mkdtemp(join(tmpdir(), "evaller-api-"));
  process.env.EVALOPS_TEST_MODE = "1";
  process.env.EVALOPS_TEST_STORE_PATH = tempDir;
});

afterEach(async () => {
  delete process.env.EVALOPS_TEST_MODE;
  delete process.env.EVALOPS_TEST_STORE_PATH;
  await rm(tempDir, { recursive: true, force: true });
});

describe("Evaller API core loop", () => {
  it("runs, applies a fix, runs again, and returns history", async () => {
    const workspaceRoute = await import("./evaller/workspace/route");
    const runRoute = await import("./evals/run/route");
    const runsRoute = await import("./evals/runs/route");
    const applyFixRoute = await import("./evals/run/[runId]/apply-fix/route");

    const workspaceResponse = await workspaceRoute.GET(request("http://localhost/api/evaller/workspace"));
    const workspacePayload = await workspaceResponse.json();
    expect(workspacePayload.ok).toBe(true);

    const draft = toDraft(workspacePayload.data);
    const firstRunResponse = await runRoute.POST(jsonRequest("http://localhost/api/evals/run", draft));
    const firstRunPayload = await firstRunResponse.json();
    expect(firstRunPayload.ok).toBe(true);
    expect(firstRunPayload.data.failedScenarios).toBeGreaterThan(0);
    expect(firstRunPayload.data.promptSuggestions.length).toBeGreaterThan(0);

    const suggestionId = firstRunPayload.data.promptSuggestions[0].id as string;
    const applyResponse = await applyFixRoute.POST(
      jsonRequest(`http://localhost/api/evals/run/${firstRunPayload.data.id}/apply-fix`, { suggestionId }),
      { params: Promise.resolve({ runId: firstRunPayload.data.id }) },
    );
    const applyPayload = await applyResponse.json();
    expect(applyPayload.ok).toBe(true);
    expect(applyPayload.data.activePrompt.instructions).toContain("Evaller improvement");

    const secondDraft = toDraft(applyPayload.data);
    const secondRunResponse = await runRoute.POST(jsonRequest("http://localhost/api/evals/run", secondDraft));
    const secondRunPayload = await secondRunResponse.json();
    expect(secondRunPayload.ok).toBe(true);
    expect(secondRunPayload.data.previousRun.id).toBe(firstRunPayload.data.id);
    expect(secondRunPayload.data.passRate).toBeGreaterThan(firstRunPayload.data.passRate);

    const runsResponse = await runsRoute.GET(request("http://localhost/api/evals/runs"));
    const runsPayload = await runsResponse.json();
    expect(runsPayload.ok).toBe(true);
    expect(runsPayload.data.map((run: { id: string }) => run.id)).toEqual([
      secondRunPayload.data.id,
      firstRunPayload.data.id,
    ]);
  });

  it("blocks invalid AI test runs before execution", async () => {
    const runRoute = await import("./evals/run/route");
    const response = await runRoute.POST(
      jsonRequest("http://localhost/api/evals/run", {
        name: "Support AI",
        description: "",
        instructions: "",
        qualityBar: 80,
        scenarios: [],
        successCriteria: [],
      }),
    );
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("invalid_ai_test");
    expect(payload.error.message).toContain("Add the AI instructions");
  });

  it("returns a safe not-found error for unknown runs", async () => {
    const runRoute = await import("./evals/run/route");
    const response = await runRoute.GET(request("http://localhost/api/evals/run?runId=missing"));
    const payload = await response.json();
    expect(response.status).toBe(404);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("run_not_found");
  });
});

function request(url: string) {
  return new NextRequest(url);
}

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
  });
}

function toDraft(workspace: {
  aiTest: { name: string; description: string; qualityBar: number };
  activePrompt: { instructions: string };
  scenarios: Array<{ id: string; title: string; message: string; expectedBehavior: string }>;
  successCriteria: Array<{ id: string; text: string }>;
}) {
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
