import { requireOpenAIAuditConfig } from "@/lib/ai/openai-audit-generation";
import { inngest } from "@/lib/inngest/client";
import { ApiError } from "@/lib/server/auth";
import { isTestMode } from "@/lib/server/env";
import { getEvalOpsStore } from "@/lib/server/store";
import type { ActorContext } from "@/lib/server/types";

export const TRACE_IMPORT_REQUESTED_EVENT = "evalops/trace-import.requested";

export type TraceImportRequestedEvent = {
  name: typeof TRACE_IMPORT_REQUESTED_EVENT;
  data: {
    actor: ActorContext;
    projectId: string;
    traceImportId: string;
    jobId: string;
  };
};

export function assertAuditRuntimeConfigured() {
  if (isTestMode()) return;

  requireOpenAIAuditConfig();

  if (!process.env.INNGEST_EVENT_KEY?.trim()) {
    throw new ApiError(503, "INNGEST_EVENT_KEY is required for production audit processing.", "inngest_not_configured");
  }
  if (!process.env.INNGEST_SIGNING_KEY?.trim()) {
    throw new ApiError(503, "INNGEST_SIGNING_KEY is required for production audit processing.", "inngest_not_configured");
  }
}

export async function enqueueTraceImportProcessing(input: TraceImportRequestedEvent["data"]) {
  if (isTestMode()) {
    await processTraceImportJob(input);
    return;
  }

  assertAuditRuntimeConfigured();
  await inngest.send({
    name: TRACE_IMPORT_REQUESTED_EVENT,
    data: input,
  });
}

export async function processTraceImportJob(input: TraceImportRequestedEvent["data"]) {
  const store = await getEvalOpsStore();
  return store.processTraceImport(input.actor, {
    projectId: input.projectId,
    traceImportId: input.traceImportId,
    jobId: input.jobId,
  });
}
