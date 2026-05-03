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
    const importPayload = await importResponse.json();
    expect(importPayload.ok).toBe(true);
    expect(importPayload.data.job.status).toBe("queued");

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

  it("generates a production-style audit report PDF after processing", async () => {
    const projectsRoute = await import("./projects/route");
    const importsRoute = await import("./projects/[projectId]/imports/route");
    const exportsRoute = await import("./projects/[projectId]/exports/route");
    const downloadRoute = await import("./exports/[exportId]/download/route");

    const projectResponse = await projectsRoute.POST(
      jsonRequest("http://localhost/api/projects", {
        name: "Board Report Audit",
        workflowType: "support_assistant",
        objective: "Create a buyer-ready audit report.",
        riskPreferences: ["Escalation", "Privacy"],
        privacyMode: "redact_pii",
      }),
    );
    const projectPayload = await projectResponse.json();
    const projectId = projectPayload.data.id as string;

    const form = new FormData();
    form.append(
      "file",
      new File(
        [
          "conversation_id,user_input,assistant_output\n" +
            "c_1,I asked three times and this is still not fixed,Try restarting the app.",
        ],
        "board-report.csv",
        { type: "text/csv" },
      ),
    );
    await importsRoute.POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/imports`, {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ projectId }) },
    );

    const exportResponse = await exportsRoute.POST(
      jsonRequest(`http://localhost/api/projects/${projectId}/exports`, {
        type: "audit_report_pdf",
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const exportPayload = await exportResponse.json();
    expect(exportPayload.ok).toBe(true);
    expect(exportPayload.data.type).toBe("audit_report_pdf");
    expect(exportPayload.data.fileName).toMatch(/audit-report\.pdf$/);
    expect(exportPayload.data.contentType).toBe("application/pdf");

    const download = await downloadRoute.GET(
      new NextRequest(`http://localhost/api/exports/${exportPayload.data.id}/download`),
      { params: Promise.resolve({ exportId: exportPayload.data.id }) },
    );
    expect(download.headers.get("content-type")).toBe("application/pdf");
    const bytes = new Uint8Array(await download.arrayBuffer());
    expect(Buffer.from(bytes.slice(0, 5)).toString("utf8")).toBe("%PDF-");
  });

  it("returns report_not_ready when PDF export is requested before the first report", async () => {
    const projectsRoute = await import("./projects/route");
    const exportsRoute = await import("./projects/[projectId]/exports/route");

    const projectResponse = await projectsRoute.POST(
      jsonRequest("http://localhost/api/projects", {
        name: "Premature Report Audit",
        workflowType: "support_assistant",
        objective: "Verify report export readiness checks.",
        riskPreferences: ["Billing"],
        privacyMode: "redact_pii",
      }),
    );
    const projectPayload = await projectResponse.json();
    const projectId = projectPayload.data.id as string;

    const exportResponse = await exportsRoute.POST(
      jsonRequest(`http://localhost/api/projects/${projectId}/exports`, {
        type: "audit_report_pdf",
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const exportPayload = await exportResponse.json();

    expect(exportResponse.status).toBe(409);
    expect(exportPayload.ok).toBe(false);
    expect(exportPayload.error.code).toBe("report_not_ready");
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

  it("normalizes JSON and NDJSON upload MIME types before persistence", async () => {
    const projectsRoute = await import("./projects/route");
    const stateRoute = await import("./app-state/route");
    const importsRoute = await import("./projects/[projectId]/imports/route");

    const projectResponse = await projectsRoute.POST(
      jsonRequest("http://localhost/api/projects", {
        name: "JSON Upload Audit",
        workflowType: "support_assistant",
        objective: "Verify JSON and NDJSON uploads are accepted.",
        riskPreferences: ["Billing"],
        privacyMode: "redact_pii",
      }),
    );
    const projectPayload = await projectResponse.json();
    const projectId = projectPayload.data.id as string;

    const jsonForm = new FormData();
    jsonForm.append(
      "file",
      new File(
        [
          JSON.stringify({
            id: "json_1",
            prompt: "I need a refund for a duplicate charge",
            response: "I can help review the duplicate charge and start a refund.",
          }),
        ],
        "support.json",
        { type: "application/octet-stream" },
      ),
    );
    const jsonImportResponse = await importsRoute.POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/imports`, {
        method: "POST",
        body: jsonForm,
      }),
      { params: Promise.resolve({ projectId }) },
    );
    expect((await jsonImportResponse.json()).ok).toBe(true);

    const ndjsonForm = new FormData();
    ndjsonForm.append(
      "file",
      new File(
        [
          JSON.stringify({
            id: "ndjson_1",
            prompt: "My account access is broken",
            response: "Let's reset your account access safely.",
          }),
        ],
        "events.ndjson",
        { type: "" },
      ),
    );
    const ndjsonImportResponse = await importsRoute.POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/imports`, {
        method: "POST",
        body: ndjsonForm,
      }),
      { params: Promise.resolve({ projectId }) },
    );
    expect((await ndjsonImportResponse.json()).ok).toBe(true);

    const stateResponse = await stateRoute.GET(
      new NextRequest(`http://localhost/api/app-state?projectId=${projectId}`),
    );
    const statePayload = await stateResponse.json();

    expect(statePayload.data.traceImports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "JSON", status: "completed" }),
        expect.objectContaining({ source: "NDJSON", status: "completed" }),
      ]),
    );
    expect(statePayload.data.uploadedFiles.map((file: { contentType: string }) => file.contentType)).toEqual(
      expect.arrayContaining(["application/json", "application/x-ndjson"]),
    );
  });

  it("rejects duplicate trace uploads with a clear conflict", async () => {
    const projectsRoute = await import("./projects/route");
    const importsRoute = await import("./projects/[projectId]/imports/route");

    const projectResponse = await projectsRoute.POST(
      jsonRequest("http://localhost/api/projects", {
        name: "Duplicate Upload Audit",
        workflowType: "support_assistant",
        objective: "Prevent duplicate uploads from creating noisy audit artifacts.",
        riskPreferences: ["Escalation"],
        privacyMode: "redact_pii",
      }),
    );
    const projectPayload = await projectResponse.json();
    const projectId = projectPayload.data.id as string;

    const upload = () => {
      const form = new FormData();
      form.append(
        "file",
        new File(
          [
            "conversation_id,user_input,assistant_output\n" +
              "c_1,I asked three times and this is still not fixed,Try restarting the app.",
          ],
          "duplicate.csv",
          { type: "text/csv" },
        ),
      );
      return importsRoute.POST(
        new NextRequest(`http://localhost/api/projects/${projectId}/imports`, {
          method: "POST",
          body: form,
        }),
        { params: Promise.resolve({ projectId }) },
      );
    };

    expect((await (await upload()).json()).ok).toBe(true);

    const duplicateResponse = await upload();
    const duplicatePayload = await duplicateResponse.json();
    expect(duplicateResponse.status).toBe(409);
    expect(duplicatePayload.ok).toBe(false);
    expect(duplicatePayload.error.code).toBe("duplicate_upload");
    expect(duplicatePayload.error.message).toContain("already been imported");
  });

  it("persists project privacy settings", async () => {
    const projectsRoute = await import("./projects/route");
    const stateRoute = await import("./app-state/route");
    const settingsRoute = await import("./projects/[projectId]/settings/route");

    const projectResponse = await projectsRoute.POST(
      jsonRequest("http://localhost/api/projects", {
        name: "Settings Audit",
        workflowType: "support_assistant",
        objective: "Verify privacy settings persist for customer rollout.",
        riskPreferences: ["Billing"],
        privacyMode: "redact_pii",
      }),
    );
    const projectPayload = await projectResponse.json();
    const projectId = projectPayload.data.id as string;

    const settingsResponse = await settingsRoute.PATCH(
      jsonRequest(
        `http://localhost/api/projects/${projectId}/settings`,
        {
          privacyMode: "derived_only",
          riskPreferences: ["Billing", "Escalation", "Privacy"],
        },
        "PATCH",
      ),
      { params: Promise.resolve({ projectId }) },
    );
    const settingsPayload = await settingsResponse.json();
    expect(settingsPayload.ok).toBe(true);
    expect(settingsPayload.data.privacyMode).toBe("derived_only");

    const stateResponse = await stateRoute.GET(
      new NextRequest(`http://localhost/api/app-state?projectId=${projectId}`),
    );
    const statePayload = await stateResponse.json();
    expect(statePayload.data.activeProject.privacyMode).toBe("derived_only");
    expect(statePayload.data.activeProject.riskPreferences).toEqual(
      expect.arrayContaining(["Billing", "Escalation", "Privacy"]),
    );
  });

  it("persists grader configuration edits", async () => {
    const projectsRoute = await import("./projects/route");
    const stateRoute = await import("./app-state/route");
    const importsRoute = await import("./projects/[projectId]/imports/route");
    const gradersRoute = await import("./graders/[graderId]/route");

    const projectResponse = await projectsRoute.POST(
      jsonRequest("http://localhost/api/projects", {
        name: "Grader Edit Audit",
        workflowType: "support_assistant",
        objective: "Verify graders can be reviewed and tuned after generation.",
        riskPreferences: ["Escalation"],
        privacyMode: "redact_pii",
      }),
    );
    const projectPayload = await projectResponse.json();
    const projectId = projectPayload.data.id as string;

    const form = new FormData();
    form.append(
      "file",
      new File(
        [
          "conversation_id,user_input,assistant_output\n" +
            "c_1,I asked three times and this is still not fixed,Try restarting the app.",
        ],
        "grader-edit.csv",
        { type: "text/csv" },
      ),
    );
    await importsRoute.POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/imports`, {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ projectId }) },
    );

    const stateResponse = await stateRoute.GET(
      new NextRequest(`http://localhost/api/app-state?projectId=${projectId}`),
    );
    const statePayload = await stateResponse.json();
    const graderId = statePayload.data.graders[0].id as string;

    const graderResponse = await gradersRoute.PATCH(
      jsonRequest(
        `http://localhost/api/graders/${graderId}`,
        {
          description: "Score escalation quality against the pilot handoff rubric.",
          active: false,
          model: "gpt-5.5",
        },
        "PATCH",
      ),
      { params: Promise.resolve({ graderId }) },
    );
    const graderPayload = await graderResponse.json();
    expect(graderPayload.ok).toBe(true);
    expect(graderPayload.data.description).toBe("Score escalation quality against the pilot handoff rubric.");
    expect(graderPayload.data.active).toBe(false);
    expect(graderPayload.data.model).toBe("gpt-5.5");
  });

  it("generates a full project JSON export through the API", async () => {
    const projectsRoute = await import("./projects/route");
    const importsRoute = await import("./projects/[projectId]/imports/route");
    const exportsRoute = await import("./projects/[projectId]/exports/route");
    const downloadRoute = await import("./exports/[exportId]/download/route");
    const receiptDownloadRoute = await import("./receipts/[receiptId]/download/route");

    const projectResponse = await projectsRoute.POST(
      jsonRequest("http://localhost/api/projects", {
        name: "Full Project Export Audit",
        workflowType: "support_assistant",
        objective: "Verify full project export packages are generated through the API.",
        riskPreferences: ["Privacy"],
        privacyMode: "redact_pii",
      }),
    );
    const projectPayload = await projectResponse.json();
    const projectId = projectPayload.data.id as string;

    const form = new FormData();
    form.append(
      "file",
      new File(
        [
          "conversation_id,user_input,assistant_output\n" +
            "c_1,I asked three times and this is still not fixed,Try restarting the app.",
        ],
        "full-export.csv",
        { type: "text/csv" },
      ),
    );
    await importsRoute.POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/imports`, {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ projectId }) },
    );

    const exportResponse = await exportsRoute.POST(
      jsonRequest(`http://localhost/api/projects/${projectId}/exports`, {
        type: "full_project_json",
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const exportPayload = await exportResponse.json();
    expect(exportPayload.ok).toBe(true);
    expect(exportPayload.data.type).toBe("full_project_json");
    expect(exportPayload.data.status).toBe("generated");
    expect(exportPayload.data.checksum).toBeTruthy();

    const download = await downloadRoute.GET(
      new NextRequest(`http://localhost/api/exports/${exportPayload.data.id}/download`),
      { params: Promise.resolve({ exportId: exportPayload.data.id }) },
    );
    const packagePayload = JSON.parse(await download.text());
    expect(packagePayload.manifest.projectId).toBe(projectId);
    expect(packagePayload.dataInventory.rawUploads.count).toBe(1);
    expect(packagePayload.records.evalCases).toHaveLength(1);

    const receiptDownload = await receiptDownloadRoute.GET(
      new NextRequest(`http://localhost/api/receipts/${exportPayload.data.receiptId}/download`),
      { params: Promise.resolve({ receiptId: exportPayload.data.receiptId }) },
    );
    const receiptPayload = JSON.parse(await receiptDownload.text());
    expect(receiptPayload.receipt.operation).toBe("full_project_export");
    expect(receiptPayload.receipt.status).toBe("completed");
  });

  it("deletes a project through the API only after exact name confirmation", async () => {
    const projectsRoute = await import("./projects/route");
    const stateRoute = await import("./app-state/route");
    const projectRoute = await import("./projects/[projectId]/route");

    const projectResponse = await projectsRoute.POST(
      jsonRequest("http://localhost/api/projects", {
        name: "Delete Through API Audit",
        workflowType: "support_assistant",
        objective: "Verify deletion is confirmed, audited, and receipt-backed.",
        riskPreferences: ["Privacy"],
        privacyMode: "redact_pii",
      }),
    );
    const projectPayload = await projectResponse.json();
    const projectId = projectPayload.data.id as string;

    const mismatchResponse = await projectRoute.DELETE(
      jsonRequest(
        `http://localhost/api/projects/${projectId}`,
        { confirmationName: "Delete Through API" },
        "DELETE",
      ),
      { params: Promise.resolve({ projectId }) },
    );
    const mismatchPayload = await mismatchResponse.json();
    expect(mismatchResponse.status).toBe(400);
    expect(mismatchPayload.error.code).toBe("confirmation_mismatch");

    const deleteResponse = await projectRoute.DELETE(
      jsonRequest(
        `http://localhost/api/projects/${projectId}`,
        { confirmationName: "Delete Through API Audit" },
        "DELETE",
      ),
      { params: Promise.resolve({ projectId }) },
    );
    const deletePayload = await deleteResponse.json();
    expect(deletePayload.ok).toBe(true);
    expect(deletePayload.data.operation).toBe("project_delete");
    expect(deletePayload.data.status).toBe("completed");

    const stateResponse = await stateRoute.GET(new NextRequest("http://localhost/api/app-state"));
    const statePayload = await stateResponse.json();
    expect(statePayload.data.projects).toHaveLength(0);
    expect(statePayload.data.dataOperationReceipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: "project_delete",
          status: "completed",
          projectId,
        }),
      ]),
    );
  });

  it("returns a user-safe error for malformed JSON request bodies", async () => {
    const projectsRoute = await import("./projects/route");

    const response = await projectsRoute.POST(
      new NextRequest("http://localhost/api/projects", {
        method: "POST",
        body: "",
        headers: { "content-type": "application/json" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("invalid_json");
    expect(payload.error.message).toBe("Request body must be valid JSON.");
  });
});

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}
