import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalEvalOpsStore } from "./local-store";

const tempDirs: string[] = [];

async function createStore() {
  const dir = await mkdtemp(join(tmpdir(), "evalops-store-"));
  tempDirs.push(dir);
  return createLocalEvalOpsStore({ rootDir: dir });
}

beforeEach(() => {
  process.env.EVALOPS_TEST_MODE = "1";
});

afterEach(async () => {
  delete process.env.EVALOPS_TEST_MODE;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("local evalops store", () => {
  it("persists organization, project, upload processing, issues, and audit events", async () => {
    const store = await createStore();
    const actor = {
      userId: "user_1",
      email: "founder@example.com",
      organizationId: "org_1",
    };

    const workspace = await store.ensureWorkspace(actor);
    const project = await store.createProject(actor, {
      name: "Support Assistant Audit",
      workflowType: "support_assistant",
      objective: "Improve escalation and billing reliability.",
      riskPreferences: ["Billing", "Escalation"],
      privacyMode: "redact_pii",
    });

    const result = await store.createTraceImport(actor, {
      projectId: project.id,
      fileName: "support.csv",
      contentType: "text/csv",
      text:
        "conversation_id,user_input,assistant_output\n" +
        "c_1,I asked three times and this is still not fixed,Try restarting the app.",
    });

    const queuedState = await store.getProjectState(actor, project.id);
    expect(result.importRecord.status).toBe("processing");
    expect(result.importRecord.primaryIntent).toBe("Pending");
    expect(result.job.status).toBe("queued");
    expect(queuedState.traces).toHaveLength(0);

    const processed = await store.processTraceImport(actor, {
      projectId: project.id,
      traceImportId: result.importRecord.id,
      jobId: result.job.id,
    });
    const state = await store.getProjectState(actor, project.id);

    expect(workspace.organization.id).toBe("org_1");
    expect(processed.importRecord.status).toBe("completed");
    expect(processed.job.status).toBe("completed");
    expect(state.traceImports).toHaveLength(1);
    expect(state.traces).toHaveLength(1);
    expect(state.evalCases).toHaveLength(1);
    expect(state.issues).toEqual([
      expect.objectContaining({ status: "open", severity: "high" }),
    ]);
    expect(state.auditEvents.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "organization.created",
        "project.created",
        "file.uploaded",
        "file.processing_queued",
        "file.processing_completed",
        "issue.created",
      ]),
    );
  });

  it("processes queued imports idempotently", async () => {
    const store = await createStore();
    const actor = {
      userId: "user_1",
      email: "founder@example.com",
      organizationId: "org_1",
    };

    await store.ensureWorkspace(actor);
    const project = await store.createProject(actor, {
      name: "Idempotent Audit",
      workflowType: "support_assistant",
      objective: "Ensure retries do not duplicate generated artifacts.",
      riskPreferences: ["Escalation"],
      privacyMode: "redact_pii",
    });
    const queued = await store.createTraceImport(actor, {
      projectId: project.id,
      fileName: "support.txt",
      contentType: "text/plain",
      text: "User: I asked three times and this is still not fixed\nAssistant: Try restarting.",
    });

    await store.processTraceImport(actor, {
      projectId: project.id,
      traceImportId: queued.importRecord.id,
      jobId: queued.job.id,
    });
    await store.processTraceImport(actor, {
      projectId: project.id,
      traceImportId: queued.importRecord.id,
      jobId: queued.job.id,
    });

    const state = await store.getProjectState(actor, project.id);
    expect(state.traces).toHaveLength(1);
    expect(state.evalCases).toHaveLength(1);
    expect(state.evalRuns).toHaveLength(1);
    expect(state.processingJobs).toEqual([
      expect.objectContaining({ id: queued.job.id, status: "completed" }),
    ]);
  });

  it("audits issue resolution and hides tenant data from other organizations", async () => {
    const store = await createStore();
    const actor = {
      userId: "user_1",
      email: "founder@example.com",
      organizationId: "org_1",
    };
    const outsider = {
      userId: "user_2",
      email: "outsider@example.com",
      organizationId: "org_2",
    };

    await store.ensureWorkspace(actor);
    const project = await store.createProject(actor, {
      name: "Support Assistant Audit",
      workflowType: "support_assistant",
      objective: "Improve escalation.",
      riskPreferences: ["Escalation"],
      privacyMode: "redact_pii",
    });
    const queued = await store.createTraceImport(actor, {
      projectId: project.id,
      fileName: "support.txt",
      contentType: "text/plain",
      text: "User: I asked three times and this is still not fixed\nAssistant: Try restarting.",
    });
    await store.processTraceImport(actor, {
      projectId: project.id,
      traceImportId: queued.importRecord.id,
      jobId: queued.job.id,
    });

    const state = await store.getProjectState(actor, project.id);
    const updated = await store.updateIssue(actor, {
      issueId: state.issues[0].id,
      status: "resolved",
      comment: "Added handoff criteria to the eval case.",
    });

    await expect(store.getProjectState(outsider, project.id)).rejects.toThrow(
      /not found/i,
    );
    expect(updated.status).toBe("resolved");
    expect((await store.getProjectState(actor, project.id)).auditEvents.map((event) => event.action)).toEqual(
      expect.arrayContaining(["issue.resolved", "issue.comment.created"]),
    );
  });

  it("serializes local writes so concurrent workspace fetches do not erase projects", async () => {
    const store = await createStore();
    const actor = {
      userId: "user_1",
      email: "founder@example.com",
      organizationId: "org_1",
    };

    await Promise.all([
      store.ensureWorkspace(actor),
      store.createProject(actor, {
        name: "Concurrent Audit",
        workflowType: "support_assistant",
        objective: "Verify local test persistence under app-shell refreshes.",
        riskPreferences: ["Reliability"],
        privacyMode: "redact_pii",
      }),
      store.ensureWorkspace(actor),
    ]);

    const state = await store.getWorkspaceState(actor);
    expect(state.projects).toHaveLength(1);
    expect(state.activeProject?.name).toBe("Concurrent Audit");
  });

  it("does not mask unreadable local state as a missing workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "evalops-store-"));
    tempDirs.push(dir);
    await writeFile(join(dir, "store.json"), "{", "utf8");
    const store = await createLocalEvalOpsStore({ rootDir: dir });

    await expect(
      store.getWorkspaceState({
        userId: "user_1",
        email: "founder@example.com",
        organizationId: "org_1",
      }),
    ).rejects.toThrow(/state file is unreadable/i);
  });

  it("purges raw uploaded content and raw trace fields for derived-only projects", async () => {
    const store = await createStore();
    const actor = {
      userId: "user_1",
      email: "founder@example.com",
      organizationId: "org_1",
    };

    await store.ensureWorkspace(actor);
    const project = await store.createProject(actor, {
      name: "Derived Only Audit",
      workflowType: "support_assistant",
      objective: "Verify raw customer traces are not retained after derived artifacts are created.",
      riskPreferences: ["Privacy"],
      privacyMode: "derived_only",
    });
    const queued = await store.createTraceImport(actor, {
      projectId: project.id,
      fileName: "privacy.csv",
      contentType: "text/csv",
      text:
        "conversation_id,user_input,assistant_output\n" +
        "c_1,My email is jane@example.com and I need this deleted,We can start a privacy request.",
    });

    await store.processTraceImport(actor, {
      projectId: project.id,
      traceImportId: queued.importRecord.id,
      jobId: queued.job.id,
    });

    const state = await store.getProjectState(actor, project.id);
    expect(state.traces).toHaveLength(1);
    expect(state.traces[0].input).toBeNull();
    expect(state.traces[0].output).toBeNull();
    expect(state.traces[0].metadata).toBeNull();
    expect(state.uploadedFiles[0].rawPurgedAt).toBeTruthy();
    expect(state.uploadedFiles[0].storageDeletedAt).toBeTruthy();
    expect(state.evalCases[0].userInput).toContain("[email]");
    expect(state.dataOperationReceipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: "raw_trace_purge",
          status: "completed",
          projectId: project.id,
        }),
      ]),
    );
  });

  it("purges retained raw content when an existing project switches to derived-only", async () => {
    const store = await createStore();
    const actor = {
      userId: "user_1",
      email: "founder@example.com",
      organizationId: "org_1",
    };

    await store.ensureWorkspace(actor);
    const project = await store.createProject(actor, {
      name: "Retention Change Audit",
      workflowType: "support_assistant",
      objective: "Verify existing raw traces are purged when privacy posture changes.",
      riskPreferences: ["Privacy"],
      privacyMode: "redact_pii",
    });
    const queued = await store.createTraceImport(actor, {
      projectId: project.id,
      fileName: "retention.csv",
      contentType: "text/csv",
      text:
        "conversation_id,user_input,assistant_output\n" +
        "c_1,Please remove my email jane@example.com,We can help with deletion.",
    });
    await store.processTraceImport(actor, {
      projectId: project.id,
      traceImportId: queued.importRecord.id,
      jobId: queued.job.id,
    });

    const retained = await store.getProjectState(actor, project.id);
    expect(retained.traces[0].input).toContain("jane@example.com");

    await store.updateProjectSettings(actor, project.id, { privacyMode: "derived_only" });
    const purged = await store.getProjectState(actor, project.id);

    expect(purged.activeProject?.privacyMode).toBe("derived_only");
    expect(purged.traces[0].input).toBeNull();
    expect(purged.traces[0].rawPurgedAt).toBeTruthy();
    expect(purged.uploadedFiles[0].storageDeletedAt).toBeTruthy();
    expect(purged.dataOperationReceipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: "raw_trace_purge",
          status: "completed",
          projectId: project.id,
        }),
      ]),
    );
  });

  it("generates a full project export package and receipt", async () => {
    const store = await createStore();
    const actor = {
      userId: "user_1",
      email: "founder@example.com",
      organizationId: "org_1",
    };

    await store.ensureWorkspace(actor);
    const project = await store.createProject(actor, {
      name: "Full Export Audit",
      workflowType: "support_assistant",
      objective: "Verify full project exports include data inventory and receipts.",
      riskPreferences: ["Escalation"],
      privacyMode: "redact_pii",
    });
    const queued = await store.createTraceImport(actor, {
      projectId: project.id,
      fileName: "export.csv",
      contentType: "text/csv",
      text:
        "conversation_id,user_input,assistant_output\n" +
        "c_1,I asked three times and this is still not fixed,Try restarting the app.",
    });
    await store.processTraceImport(actor, {
      projectId: project.id,
      traceImportId: queued.importRecord.id,
      jobId: queued.job.id,
    });

    const requested = await store.requestFullProjectExport(actor, project.id);
    const generated = await store.processFullProjectExport(actor, {
      projectId: project.id,
      exportId: requested.exportRecord.id,
      jobId: requested.job.id,
    });
    const download = await store.getExport(actor, generated.exportRecord.id);
    const payload = JSON.parse(String(download.content));

    expect(generated.exportRecord.type).toBe("full_project_json");
    expect(generated.exportRecord.status).toBe("generated");
    expect(generated.receipt.status).toBe("completed");
    expect(payload.manifest.projectId).toBe(project.id);
    expect(payload.dataInventory.rawUploads.count).toBe(1);
    expect(payload.records.evalCases).toHaveLength(1);
    expect(payload.records.evalResults).toBeDefined();
  });

  it("persists executed eval results, calibration labels, and prompt candidate bodies", async () => {
    const store = await createStore();
    const actor = {
      userId: "user_1",
      email: "founder@example.com",
      organizationId: "org_1",
    };

    await store.ensureWorkspace(actor);
    const project = await store.createProject(actor, {
      name: "Milestone 5 Audit",
      workflowType: "support_assistant",
      objective: "Verify eval execution and calibration evidence.",
      riskPreferences: ["Escalation"],
      privacyMode: "redact_pii",
    });
    const queued = await store.createTraceImport(actor, {
      projectId: project.id,
      fileName: "m5.csv",
      contentType: "text/csv",
      text:
        "conversation_id,user_input,assistant_output\n" +
        "c_1,I asked three times and this is still not fixed,I understand this is frustrating and can create a ticket for a human agent.",
    });
    await store.processTraceImport(actor, {
      projectId: project.id,
      traceImportId: queued.importRecord.id,
      jobId: queued.job.id,
    });

    const run = await store.rerunEvaluation(actor, project.id);
    const afterRun = await store.getProjectState(actor, project.id);
    const evalResult = afterRun.evalResults.find((item) => item.evalRunId === run.id);

    expect(evalResult).toEqual(
      expect.objectContaining({
        evalCaseId: afterRun.evalCases[0].id,
        graderId: afterRun.graders[0].id,
        status: "passed",
      }),
    );
    expect(run.passRate).toBe(100);

    const label = await store.upsertHumanLabel(actor, {
      evalCaseId: afterRun.evalCases[0].id,
      graderId: afterRun.graders[0].id,
      score: 40,
      status: "failed",
      notes: "Reference reviewer expected a stronger escalation.",
    });
    const afterLabel = await store.getProjectState(actor, project.id);

    expect(label.status).toBe("failed");
    expect(afterLabel.humanLabels).toHaveLength(1);
    expect(afterLabel.graderCalibrationResults).toEqual([
      expect.objectContaining({
        evalCaseId: afterRun.evalCases[0].id,
        disagreementSeverity: "high",
        reviewStatus: "open",
      }),
    ]);
    expect(afterLabel.graders[0].health).toBe("low_agreement");

    const candidate = afterLabel.promptCandidates[0];
    expect(candidate.promptBody).toContain("support assistant");
    const promoted = await store.promotePromptCandidate(actor, project.id, candidate.id);
    expect(promoted.prompt).toBe(candidate.promptBody);
  });

  it("deletes a project after typed confirmation and preserves a deletion receipt", async () => {
    const store = await createStore();
    const actor = {
      userId: "user_1",
      email: "founder@example.com",
      organizationId: "org_1",
    };

    await store.ensureWorkspace(actor);
    const project = await store.createProject(actor, {
      name: "Delete Me Audit",
      workflowType: "support_assistant",
      objective: "Verify destructive project deletion is confirmed and receipt-backed.",
      riskPreferences: ["Privacy"],
      privacyMode: "redact_pii",
    });

    await expect(
      store.requestProjectDeletion(actor, project.id, { confirmationName: "wrong name" }),
    ).rejects.toThrow(/project name/i);

    const requested = await store.requestProjectDeletion(actor, project.id, {
      confirmationName: project.name,
    });
    const deleted = await store.processProjectDeletion(actor, {
      projectId: project.id,
      jobId: requested.job.id,
      receiptId: requested.receipt.id,
    });
    const state = await store.getWorkspaceState(actor);

    expect(deleted.receipt.status).toBe("completed");
    expect(state.projects).toHaveLength(0);
    expect(state.dataOperationReceipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: requested.receipt.id,
          operation: "project_delete",
          status: "completed",
          projectId: project.id,
        }),
      ]),
    );
  });
});
