import { type NextRequest } from "next/server";
import { getActorFromRequest } from "@/lib/server/auth";
import { handleApi, readJsonBody } from "@/lib/server/api";
import { createExportRequestSchema } from "@/lib/server/schemas";
import { getEvalOpsStore } from "@/lib/server/store";
import { enqueueFullProjectExport } from "@/lib/workflows/privacy-operations";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const { projectId } = await params;
    const store = await getEvalOpsStore();
    const hasJsonBody = request.headers.get("content-type")?.includes("application/json");
    const input = hasJsonBody
      ? createExportRequestSchema.parse(await readJsonBody(request))
      : createExportRequestSchema.parse({});
    if (input.type === "full_project_json") {
      const queued = await store.requestFullProjectExport(actor, projectId);
      const processed = await enqueueFullProjectExport({
        actor,
        projectId,
        exportId: queued.exportRecord.id,
        jobId: queued.job.id,
      });
      return processed?.exportRecord || queued.exportRecord;
    }
    return store.createExport(actor, projectId, input);
  });
}
