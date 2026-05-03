import { createHash } from "node:crypto";
import type {
  DataOperationReceipt,
  ExportRecord,
  UploadedFile,
  WorkspaceState,
} from "./types";

export const RAW_TRACE_RETENTION_DAYS = 14;

export type DataInventory = ReturnType<typeof buildDataInventory>;

export type FullProjectExportPackage = ReturnType<typeof buildFullProjectExportPackage>;

export function buildDataInventory(state: WorkspaceState) {
  const rawUploadsRetained = state.uploadedFiles.filter((file) => !file.rawPurgedAt && !file.storageDeletedAt);
  const rawUploadsPurged = state.uploadedFiles.filter((file) => file.rawPurgedAt || file.storageDeletedAt);
  const rawTracesRetained = state.traces.filter((trace) => trace.input !== null || trace.output !== null || trace.metadata !== null);
  const rawTracesPurged = state.traces.filter((trace) => trace.input === null && trace.output === null && trace.metadata === null);
  const exportBytes = state.exports.reduce((total, item) => total + item.sizeBytes, 0);

  return {
    organizationId: state.organization.id,
    projectId: state.activeProject?.id,
    generatedAt: new Date().toISOString(),
    rawUploads: {
      count: state.uploadedFiles.length,
      retained: rawUploadsRetained.length,
      purged: rawUploadsPurged.length,
      bytes: rawUploadsRetained.reduce((total, item) => total + item.sizeBytes, 0),
      retentionExpiresAt: earliestDefined(state.uploadedFiles.map((file) => file.rawRetentionExpiresAt)),
    },
    rawTraces: {
      count: state.traces.length,
      retained: rawTracesRetained.length,
      purged: rawTracesPurged.length,
      retentionExpiresAt: earliestDefined(state.traces.map((trace) => trace.rawRetentionExpiresAt)),
    },
    derivedArtifacts: {
      evalCases: state.evalCases.length,
      graders: state.graders.length,
      issues: state.issues.length,
      issueComments: state.issueComments.length,
      evalRuns: state.evalRuns.length,
      evalResults: state.evalResults.length,
      humanLabels: state.humanLabels.length,
      graderCalibrationRuns: state.graderCalibrationRuns.length,
      graderCalibrationResults: state.graderCalibrationResults.length,
      failureClusters: state.failureClusters.length,
      promptVersions: state.promptVersions.length,
      promptCandidates: state.promptCandidates.length,
      routingRules: state.routingRules.length,
      cacheRecommendations: state.cacheRecommendations.length,
      reports: state.reports.length,
    },
    exports: {
      count: state.exports.length,
      bytes: exportBytes,
      generated: state.exports.filter((item) => item.status === "generated").length,
      failed: state.exports.filter((item) => item.status === "failed").length,
    },
    operationalRecords: {
      processingJobs: state.processingJobs.length,
      receipts: state.dataOperationReceipts.length,
    },
    auditEvents: {
      count: state.auditEvents.length,
      latestAt: state.auditEvents[0]?.createdAt,
    },
  };
}

export function buildFullProjectExportPackage(
  state: WorkspaceState,
  options: {
    exportId: string;
    requestedBy: string;
    generatedAt: string;
  },
) {
  if (!state.activeProject) {
    throw new Error("Select a project before creating a full project export.");
  }

  return {
    manifest: {
      exportId: options.exportId,
      organizationId: state.organization.id,
      organizationName: state.organization.name,
      projectId: state.activeProject.id,
      projectName: state.activeProject.name,
      privacyMode: state.activeProject.privacyMode,
      generatedAt: options.generatedAt,
      requestedBy: options.requestedBy,
      formatVersion: 1,
    },
    dataInventory: buildDataInventory(state),
    records: {
      project: state.activeProject,
      traceImports: state.traceImports,
      traces: state.traces,
      evalCases: state.evalCases,
      graders: state.graders,
      issues: state.issues,
      issueComments: state.issueComments,
      evalRuns: state.evalRuns,
      evalResults: state.evalResults,
      humanLabels: state.humanLabels,
      graderCalibrationRuns: state.graderCalibrationRuns,
      graderCalibrationResults: state.graderCalibrationResults,
      failureClusters: state.failureClusters,
      promptVersions: state.promptVersions,
      promptCandidates: state.promptCandidates,
      routingRules: state.routingRules,
      cacheRecommendations: state.cacheRecommendations,
      reports: state.reports,
      exports: state.exports,
      processingJobs: state.processingJobs,
      receipts: state.dataOperationReceipts,
      auditEvents: state.auditEvents,
    },
    storage: {
      uploadedFiles: state.uploadedFiles.map(storageItem),
      exports: state.exports.map(exportStorageItem),
    },
    externalProcessors: {
      openAI: "Audit generation sends redacted trace text only and uses store:false.",
      inngest: "Background workflows store operational event/job metadata.",
    },
  };
}

export function encodeFullProjectExportPackage(payload: FullProjectExportPackage) {
  return JSON.stringify(payload, null, 2);
}

export function checksumContent(content: string | Uint8Array) {
  return createHash("sha256").update(content).digest("hex");
}

export function rawRetentionExpiryFrom(now: string | Date) {
  const date = typeof now === "string" ? new Date(now) : now;
  return new Date(date.getTime() + RAW_TRACE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function createReceipt(input: {
  id: string;
  organizationId: string;
  projectId?: string;
  operation: DataOperationReceipt["operation"];
  status: DataOperationReceipt["status"];
  actorUserId: string;
  summary: string;
  metadata?: Record<string, unknown>;
  exportId?: string;
  jobId?: string;
  createdAt: string;
  completedAt?: string;
}): DataOperationReceipt {
  return {
    id: input.id,
    organizationId: input.organizationId,
    projectId: input.projectId,
    operation: input.operation,
    status: input.status,
    actorUserId: input.actorUserId,
    summary: input.summary,
    metadata: input.metadata || {},
    exportId: input.exportId,
    jobId: input.jobId,
    createdAt: input.createdAt,
    completedAt: input.completedAt,
  };
}

function storageItem(file: UploadedFile) {
  return {
    id: file.id,
    fileName: file.fileName,
    bucket: file.storageBucket,
    path: file.storagePath,
    sizeBytes: file.sizeBytes,
    contentType: file.contentType,
    retained: !file.rawPurgedAt && !file.storageDeletedAt,
    rawRetentionExpiresAt: file.rawRetentionExpiresAt,
    rawPurgedAt: file.rawPurgedAt,
    storageDeletedAt: file.storageDeletedAt,
  };
}

function exportStorageItem(record: ExportRecord) {
  return {
    id: record.id,
    fileName: record.fileName,
    bucket: record.storageBucket,
    path: record.storagePath,
    sizeBytes: record.sizeBytes,
    contentType: record.contentType,
    checksum: record.checksum,
    retained: record.status === "generated",
    createdAt: record.createdAt,
    completedAt: record.completedAt,
  };
}

function earliestDefined(values: Array<string | undefined>) {
  return values.filter(Boolean).sort()[0];
}
