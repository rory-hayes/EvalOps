import { processTraceImportJob, TRACE_IMPORT_REQUESTED_EVENT } from "@/lib/workflows/audit-processor";
import {
  FULL_PROJECT_EXPORT_REQUESTED_EVENT,
  PROJECT_DELETE_REQUESTED_EVENT,
  processFullProjectExportJob,
  processProjectDeletionJob,
} from "@/lib/workflows/privacy-operations";
import { inngest } from "./client";

export const processTraceImport = inngest.createFunction(
  {
    id: "process-trace-import",
    name: "Process trace import",
    retries: 2,
    triggers: [{ event: TRACE_IMPORT_REQUESTED_EVENT }],
  },
  async ({ event, step }) => {
    return step.run("Parse traces and generate audit artifacts", async () => {
      return processTraceImportJob(event.data as Parameters<typeof processTraceImportJob>[0]);
    });
  },
);

export const processFullProjectExport = inngest.createFunction(
  {
    id: "process-full-project-export",
    name: "Process full project export",
    retries: 2,
    triggers: [{ event: FULL_PROJECT_EXPORT_REQUESTED_EVENT }],
  },
  async ({ event, step }) => {
    return step.run("Package project data export", async () => {
      return processFullProjectExportJob(event.data as Parameters<typeof processFullProjectExportJob>[0]);
    });
  },
);

export const processProjectDeletion = inngest.createFunction(
  {
    id: "process-project-deletion",
    name: "Process project deletion",
    retries: 1,
    triggers: [{ event: PROJECT_DELETE_REQUESTED_EVENT }],
  },
  async ({ event, step }) => {
    return step.run("Delete project records and storage objects", async () => {
      return processProjectDeletionJob(event.data as Parameters<typeof processProjectDeletionJob>[0]);
    });
  },
);

export const functions = [processTraceImport, processFullProjectExport, processProjectDeletion];
