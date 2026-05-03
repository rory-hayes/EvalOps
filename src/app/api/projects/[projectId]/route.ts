import { type NextRequest } from "next/server";
import { handleApi, readJsonBody } from "@/lib/server/api";
import { getActorFromRequest } from "@/lib/server/auth";
import { deleteProjectRequestSchema } from "@/lib/server/schemas";
import { getEvalOpsStore } from "@/lib/server/store";
import { enqueueProjectDeletion } from "@/lib/workflows/privacy-operations";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const { projectId } = await params;
    const input = deleteProjectRequestSchema.parse(await readJsonBody(request));
    const store = await getEvalOpsStore();
    const queued = await store.requestProjectDeletion(actor, projectId, input);
    const processed = await enqueueProjectDeletion({
      actor,
      projectId,
      jobId: queued.job.id,
      receiptId: queued.receipt.id,
    });
    return processed?.receipt || queued.receipt;
  });
}
