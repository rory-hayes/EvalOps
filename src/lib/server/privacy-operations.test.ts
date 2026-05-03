import { describe, expect, it } from "vitest";
import { buildDataInventory, buildFullProjectExportPackage } from "./privacy-operations";
import type { WorkspaceState } from "./types";

describe("privacy operations", () => {
  it("builds a customer-visible data inventory from workspace state", () => {
    const state = buildWorkspaceState();

    const inventory = buildDataInventory(state);

    expect(inventory).toEqual(
      expect.objectContaining({
        projectId: "proj_1",
        rawUploads: expect.objectContaining({ count: 1, retained: 1, purged: 0 }),
        rawTraces: expect.objectContaining({ count: 1, retained: 1, purged: 0 }),
        derivedArtifacts: expect.objectContaining({
          evalCases: 1,
          graders: 1,
          reports: 1,
        }),
        exports: expect.objectContaining({ count: 1, bytes: 128 }),
        auditEvents: expect.objectContaining({ count: 1 }),
      }),
    );
  });

  it("builds a full project export package with manifest, records, and retention state", () => {
    const state = buildWorkspaceState();

    const exported = buildFullProjectExportPackage(state, {
      exportId: "exp_full",
      requestedBy: "user_1",
      generatedAt: "2026-05-03T14:00:00.000Z",
    });

    expect(exported.manifest).toEqual(
      expect.objectContaining({
        exportId: "exp_full",
        projectId: "proj_1",
        projectName: "Support Assistant Audit",
        generatedAt: "2026-05-03T14:00:00.000Z",
      }),
    );
    expect(exported.dataInventory.rawUploads.retained).toBe(1);
    expect(exported.records.traces[0]).toEqual(
      expect.objectContaining({
        id: "trace_1",
        input: "Raw question",
        output: "Raw answer",
        redactedInput: "Redacted question",
      }),
    );
    expect(exported.storage.uploadedFiles[0]).toEqual(
      expect.objectContaining({
        bucket: "evalops-trace-uploads",
        path: "org_1/proj_1/imp_1/source.csv",
        retained: true,
      }),
    );
  });
});

function buildWorkspaceState(): WorkspaceState {
  return {
    organization: {
      id: "org_1",
      name: "EvalOps",
      slug: "evalops",
      createdAt: "2026-05-03T12:00:00.000Z",
    },
    user: {
      id: "user_1",
      email: "founder@example.com",
      displayName: "Founder",
      createdAt: "2026-05-03T12:00:00.000Z",
    },
    membership: {
      id: "mem_1",
      organizationId: "org_1",
      userId: "user_1",
      role: "owner",
      createdAt: "2026-05-03T12:00:00.000Z",
    },
    projects: [
      {
        id: "proj_1",
        organizationId: "org_1",
        name: "Support Assistant Audit",
        workflowType: "support_assistant",
        objective: "Improve escalation reliability.",
        riskPreferences: ["Escalation"],
        privacyMode: "redact_pii",
        status: "active",
        createdAt: "2026-05-03T12:00:00.000Z",
        updatedAt: "2026-05-03T12:00:00.000Z",
      },
    ],
    activeProject: {
      id: "proj_1",
      organizationId: "org_1",
      name: "Support Assistant Audit",
      workflowType: "support_assistant",
      objective: "Improve escalation reliability.",
      riskPreferences: ["Escalation"],
      privacyMode: "redact_pii",
      status: "active",
      createdAt: "2026-05-03T12:00:00.000Z",
      updatedAt: "2026-05-03T12:00:00.000Z",
    },
    traceImports: [
      {
        id: "imp_1",
        source: "CSV",
        name: "source.csv",
        importedAt: "2026-05-03T12:00:00.000Z",
        traces: 1,
        rows: 1,
        status: "completed",
        redactionStatus: "redacted",
        primaryIntent: "Escalation",
        riskLevel: "high",
      },
    ],
    traces: [
      {
        id: "trace_1",
        organizationId: "org_1",
        projectId: "proj_1",
        traceImportId: "imp_1",
        externalId: "row_1",
        sourceType: "CSV",
        input: "Raw question",
        output: "Raw answer",
        redactedInput: "Redacted question",
        redactedOutput: "Redacted answer",
        redactionHits: ["email"],
        intent: "Escalation",
        riskLevel: "high",
        occurredAt: "2026-05-03T12:00:00.000Z",
        metadata: { source: "test" },
      },
    ],
    uploadedFiles: [
      {
        id: "file_1",
        organizationId: "org_1",
        projectId: "proj_1",
        traceImportId: "imp_1",
        fileName: "source.csv",
        contentType: "text/csv",
        sizeBytes: 64,
        storageBucket: "evalops-trace-uploads",
        storagePath: "org_1/proj_1/imp_1/source.csv",
        checksum: "checksum",
        createdAt: "2026-05-03T12:00:00.000Z",
      },
    ],
    processingJobs: [],
    evalCases: [
      {
        id: "case_1",
        organizationId: "org_1",
        projectId: "proj_1",
        traceId: "trace_1",
        name: "Escalation case",
        set: "regression",
        intent: "Escalation",
        source: "production",
        risk: "high",
        grader: "Rubric",
        lastResult: 42,
        status: "failed",
        userInput: "Redacted question",
        expectedBehavior: "Escalate.",
        acceptanceCriteria: ["Handoff"],
        createdAt: "2026-05-03T12:00:00.000Z",
        updatedAt: "2026-05-03T12:00:00.000Z",
      },
    ],
    graders: [
      {
        id: "grader_1",
        organizationId: "org_1",
        projectId: "proj_1",
        name: "Rubric",
        type: "deterministic",
        description: "Scores handoff quality.",
        health: "review",
        agreement: 0.7,
        active: true,
        passThreshold: 0.8,
        reviewThreshold: 0.6,
        rubric: "Scores handoff quality.",
        failureModes: ["Missing handoff"],
        createdAt: "2026-05-03T12:00:00.000Z",
        updatedAt: "2026-05-03T12:00:00.000Z",
      },
    ],
    issues: [],
    issueComments: [],
    evalRuns: [],
    evalResults: [],
    humanLabels: [],
    graderCalibrationRuns: [],
    graderCalibrationResults: [],
    failureClusters: [],
    promptVersions: [],
    promptCandidates: [],
    routingRules: [],
    cacheRecommendations: [],
    reports: [
      {
        id: "report_1",
        organizationId: "org_1",
        projectId: "proj_1",
        title: "Audit Report",
        summary: "One risk.",
        readinessScore: 62,
        recommendations: ["Fix escalation."],
        createdAt: "2026-05-03T12:00:00.000Z",
      },
    ],
    exports: [
      {
        id: "exp_1",
        organizationId: "org_1",
        projectId: "proj_1",
        type: "eval_pack_csv",
        status: "generated",
        storageBucket: "evalops-exports",
        storagePath: "org_1/proj_1/export.csv",
        fileName: "export.csv",
        contentType: "text/csv",
        sizeBytes: 128,
        createdAt: "2026-05-03T12:00:00.000Z",
      },
    ],
    dataOperationReceipts: [],
    auditEvents: [
      {
        id: "evt_1",
        organizationId: "org_1",
        actorUserId: "user_1",
        entityType: "project",
        entityId: "proj_1",
        action: "project.created",
        status: "succeeded",
        metadata: {},
        createdAt: "2026-05-03T12:00:00.000Z",
      },
    ],
  };
}
