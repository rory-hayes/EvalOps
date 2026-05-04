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
    expect(secondRunPayload.data.readinessReport.status).toBe("Ready for release review");
    expect(secondRunPayload.data.readinessReport.approvalStatus).toBe("pending");

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

  it("persists report review comments, approval, copy tracking, and prompt restores", async () => {
    const workspaceRoute = await import("./evaller/workspace/route");
    const runRoute = await import("./evals/run/route");
    const applyFixRoute = await import("./evals/run/[runId]/apply-fix/route");
    const commentRoute = await import("./evals/run/[runId]/comments/route");
    const approveRoute = await import("./evals/run/[runId]/readiness-report/approve/route");
    const copyRoute = await import("./evals/run/[runId]/readiness-report/copy/route");
    const restoreRoute = await import("./evals/prompt-versions/[promptVersionId]/restore/route");
    const inviteRoute = await import("./organizations/invitations/route");
    const acceptInviteRoute = await import("./invitations/[token]/accept/route");

    const ownerHeaders = testHeaders("release-owner", "org_release_workflow");
    const reviewerHeaders = testHeaders("release-reviewer", "org_release_workflow");

    const workspaceResponse = await workspaceRoute.GET(request("http://localhost/api/evaller/workspace", ownerHeaders));
    const workspacePayload = await workspaceResponse.json();
    const firstPromptVersionId = workspacePayload.data.promptVersions.find(
      (prompt: { label: string }) => prompt.label === "Prompt v1",
    ).id as string;

    const firstRunResponse = await runRoute.POST(jsonRequest("http://localhost/api/evals/run", toDraft(workspacePayload.data), "POST", ownerHeaders));
    const firstRunPayload = await firstRunResponse.json();
    const suggestionId = firstRunPayload.data.promptSuggestions[0].id as string;

    const applyResponse = await applyFixRoute.POST(
      jsonRequest(`http://localhost/api/evals/run/${firstRunPayload.data.id}/apply-fix`, { suggestionId }, "POST", ownerHeaders),
      { params: Promise.resolve({ runId: firstRunPayload.data.id }) },
    );
    const applyPayload = await applyResponse.json();

    const secondRunResponse = await runRoute.POST(jsonRequest("http://localhost/api/evals/run", toDraft(applyPayload.data), "POST", ownerHeaders));
    const secondRunPayload = await secondRunResponse.json();
    const runId = secondRunPayload.data.id as string;
    const reportId = secondRunPayload.data.readinessReport.id as string;

    const commentResponse = await commentRoute.POST(
      jsonRequest(`http://localhost/api/evals/run/${runId}/comments`, { body: "Release manager reviewed this prompt." }, "POST", ownerHeaders),
      { params: Promise.resolve({ runId }) },
    );
    const commentPayload = await commentResponse.json();
    expect(commentPayload.ok).toBe(true);
    expect(commentPayload.data.body).toBe("Release manager reviewed this prompt.");
    expect(commentPayload.data.reportId).toBe(reportId);

    const copyResponse = await copyRoute.POST(
      jsonRequest(`http://localhost/api/evals/run/${runId}/readiness-report/copy`, {}, "POST", ownerHeaders),
      { params: Promise.resolve({ runId }) },
    );
    const copyPayload = await copyResponse.json();
    expect(copyPayload.ok).toBe(true);
    expect(copyPayload.data.copyCount).toBe(1);
    expect(copyPayload.data.lastCopiedAt).toEqual(expect.any(String));

    const approveResponse = await approveRoute.POST(
      jsonRequest(
        `http://localhost/api/evals/run/${runId}/readiness-report/approve`,
        { status: "approved", note: "Ready for the support launch." },
        "POST",
        ownerHeaders,
      ),
      { params: Promise.resolve({ runId }) },
    );
    const approvePayload = await approveResponse.json();
    expect(approvePayload.ok).toBe(true);
    expect(approvePayload.data.approvalStatus).toBe("approved");
    expect(approvePayload.data.approvedBy).toBe("user_release-owner");
    expect(approvePayload.data.approvalNote).toBe("Ready for the support launch.");

    const refreshedRunResponse = await runRoute.GET(request(`http://localhost/api/evals/run?runId=${runId}`, ownerHeaders));
    const refreshedRunPayload = await refreshedRunResponse.json();
    expect(refreshedRunPayload.data.readinessReport.approvalStatus).toBe("approved");
    expect(refreshedRunPayload.data.readinessReport.copyCount).toBe(1);
    expect(refreshedRunPayload.data.comments).toHaveLength(1);
    expect(refreshedRunPayload.data.comments[0].body).toBe("Release manager reviewed this prompt.");

    const inviteResponse = await inviteRoute.POST(
      jsonRequest("http://localhost/api/organizations/invitations", { email: "reviewer@example.test", role: "reviewer" }, "POST", ownerHeaders),
    );
    const invitePayload = await inviteResponse.json();
    expect(invitePayload.ok).toBe(true);
    await acceptInviteRoute.POST(
      request(`http://localhost/api/invitations/${invitePayload.data.token}/accept`, reviewerHeaders, "POST"),
      { params: Promise.resolve({ token: invitePayload.data.token }) },
    );

    const reviewerApprovalResponse = await approveRoute.POST(
      jsonRequest(
        `http://localhost/api/evals/run/${runId}/readiness-report/approve`,
        { status: "changes_requested", note: "Reviewer cannot approve." },
        "POST",
        reviewerHeaders,
      ),
      { params: Promise.resolve({ runId }) },
    );
    const reviewerApprovalPayload = await reviewerApprovalResponse.json();
    expect(reviewerApprovalResponse.status).toBe(403);
    expect(reviewerApprovalPayload.error.code).toBe("forbidden");

    const restoreResponse = await restoreRoute.POST(
      request(`http://localhost/api/evals/prompt-versions/${firstPromptVersionId}/restore`, ownerHeaders, "POST"),
      { params: Promise.resolve({ promptVersionId: firstPromptVersionId }) },
    );
    const restorePayload = await restoreResponse.json();
    expect(restorePayload.ok).toBe(true);
    expect(restorePayload.data.activePrompt.label).toBe("Prompt v3: Restore Prompt v1");
    expect(restorePayload.data.activePrompt.instructions).toBe(workspacePayload.data.activePrompt.instructions);
    expect(restorePayload.data.promptVersions.some((prompt: { id: string; label: string }) => prompt.id === firstPromptVersionId && prompt.label === "Prompt v1")).toBe(true);
  });
});

function request(url: string, headers: Record<string, string> = {}, method = "GET") {
  return new NextRequest(url, {
    method,
    headers,
  });
}

function jsonRequest(url: string, body: unknown, method = "POST", headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

function testHeaders(key: string, organizationId: string) {
  return {
    "x-evalops-test-user-id": `user_${key}`,
    "x-evalops-test-email": `${key}@example.test`,
    "x-evalops-test-org-id": organizationId,
  };
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
