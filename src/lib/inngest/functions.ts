import { processTraceImportJob, TRACE_IMPORT_REQUESTED_EVENT } from "@/lib/workflows/audit-processor";
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

export const functions = [processTraceImport];
