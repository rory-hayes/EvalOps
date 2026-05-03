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
});
