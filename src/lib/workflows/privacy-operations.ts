import { inngest } from "@/lib/inngest/client";
import { isTestMode } from "@/lib/server/env";
import { getEvalOpsStore } from "@/lib/server/store";
import type { ActorContext } from "@/lib/server/types";

export const FULL_PROJECT_EXPORT_REQUESTED_EVENT = "evalops/project-export.requested";
export const PROJECT_DELETE_REQUESTED_EVENT = "evalops/project-delete.requested";

export type FullProjectExportRequestedEvent = {
  name: typeof FULL_PROJECT_EXPORT_REQUESTED_EVENT;
  data: {
    actor: ActorContext;
    projectId: string;
    exportId: string;
    jobId: string;
  };
};

export type ProjectDeleteRequestedEvent = {
  name: typeof PROJECT_DELETE_REQUESTED_EVENT;
  data: {
    actor: ActorContext;
    projectId: string;
    jobId: string;
    receiptId: string;
  };
};

export async function enqueueFullProjectExport(input: FullProjectExportRequestedEvent["data"]) {
  if (isTestMode()) {
    return processFullProjectExportJob(input);
  }

  await inngest.send({
    name: FULL_PROJECT_EXPORT_REQUESTED_EVENT,
    data: input,
  });
  return undefined;
}

export async function enqueueProjectDeletion(input: ProjectDeleteRequestedEvent["data"]) {
  if (isTestMode()) {
    return processProjectDeletionJob(input);
  }

  await inngest.send({
    name: PROJECT_DELETE_REQUESTED_EVENT,
    data: input,
  });
  return undefined;
}

export async function processFullProjectExportJob(input: FullProjectExportRequestedEvent["data"]) {
  const store = await getEvalOpsStore();
  return store.processFullProjectExport(input.actor, {
    projectId: input.projectId,
    exportId: input.exportId,
    jobId: input.jobId,
  });
}

export async function processProjectDeletionJob(input: ProjectDeleteRequestedEvent["data"]) {
  const store = await getEvalOpsStore();
  return store.processProjectDeletion(input.actor, {
    projectId: input.projectId,
    jobId: input.jobId,
    receiptId: input.receiptId,
  });
}
