import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let tempDir = "";

beforeEach(async () => {
  vi.resetModules();
  tempDir = await mkdtemp(join(tmpdir(), "evalops-api-"));
  process.env.EVALOPS_TEST_MODE = "1";
  process.env.EVALOPS_TEST_STORE_PATH = tempDir;
});

afterEach(async () => {
  delete process.env.EVALOPS_TEST_MODE;
  delete process.env.EVALOPS_TEST_STORE_PATH;
  await rm(tempDir, { recursive: true, force: true });
});

describe("EvalOps API core flow", () => {
  it("creates a project, uploads traces, resolves an issue, and exports CSV", async () => {
    const projectsRoute = await import("./projects/route");
    const stateRoute = await import("./app-state/route");
    const importsRoute = await import("./projects/[projectId]/imports/route");
    const issuesRoute = await import("./issues/[issueId]/route");
    const exportsRoute = await import("./projects/[projectId]/exports/route");
    const downloadRoute = await import("./exports/[exportId]/download/route");

    const projectResponse = await projectsRoute.POST(
      jsonRequest("http://localhost/api/projects", {
        name: "Support Assistant Audit",
        workflowType: "support_assistant",
        objective: "Improve escalation and billing reliability across the support assistant.",
        riskPreferences: ["Escalation", "Billing"],
        privacyMode: "redact_pii",
      }),
    );
    const projectPayload = await projectResponse.json();
    expect(projectPayload.ok).toBe(true);
    const projectId = projectPayload.data.id as string;

    const form = new FormData();
    form.append(
      "file",
      new File(
        [
          "conversation_id,user_input,assistant_output\n" +
            "c_1,I asked three times and this is still not fixed,Try restarting the app.",
        ],
        "support.csv",
        { type: "text/csv" },
      ),
    );
    const importResponse = await importsRoute.POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/imports`, {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ projectId }) },
    );
    expect((await importResponse.json()).ok).toBe(true);

    const stateResponse = await stateRoute.GET(
      new NextRequest(`http://localhost/api/app-state?projectId=${projectId}`),
    );
    const statePayload = await stateResponse.json();
    expect(statePayload.data.traceImports[0].status).toBe("completed");
    expect(statePayload.data.issues[0].status).toBe("open");
    const issueId = statePayload.data.issues[0].id as string;

    const issueResponse = await issuesRoute.PATCH(
      jsonRequest(`http://localhost/api/issues/${issueId}`, {
        status: "resolved",
        comment: "Added explicit handoff acceptance criteria.",
      }),
      { params: Promise.resolve({ issueId }) },
    );
    expect((await issueResponse.json()).data.status).toBe("resolved");

    const exportResponse = await exportsRoute.POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/exports`, {
        method: "POST",
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const exportPayload = await exportResponse.json();
    expect(exportPayload.ok).toBe(true);

    const download = await downloadRoute.GET(
      new NextRequest(`http://localhost/api/exports/${exportPayload.data.id}/download`),
      { params: Promise.resolve({ exportId: exportPayload.data.id }) },
    );
    expect(await download.text()).toContain("case_id,name,set,intent,risk,status,last_result,open_issues");
  });

  it("returns a user-safe error for unsupported upload content", async () => {
    const projectsRoute = await import("./projects/route");
    const importsRoute = await import("./projects/[projectId]/imports/route");

    const projectResponse = await projectsRoute.POST(
      jsonRequest("http://localhost/api/projects", {
        name: "Unsupported Upload Audit",
        workflowType: "support_assistant",
        objective: "Verify failed imports are visible.",
        riskPreferences: ["Privacy"],
        privacyMode: "redact_pii",
      }),
    );
    const projectPayload = await projectResponse.json();
    const projectId = projectPayload.data.id as string;

    const form = new FormData();
    form.append(
      "file",
      new File(["not a trace"], "support.exe", { type: "application/octet-stream" }),
    );
    const importResponse = await importsRoute.POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/imports`, {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const importPayload = await importResponse.json();

    expect(importResponse.status).toBe(400);
    expect(importPayload.ok).toBe(false);
    expect(importPayload.error.message).toContain("Unsupported file type");
    expect(importPayload.error.correlationId).toBeTruthy();
  });
});

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}
