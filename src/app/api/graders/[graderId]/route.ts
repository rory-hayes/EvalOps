import { type NextRequest } from "next/server";
import { handleApi, readJsonBody } from "@/lib/server/api";
import { getActorFromRequest } from "@/lib/server/auth";
import { updateGraderRequestSchema } from "@/lib/server/schemas";
import { getEvalOpsStore } from "@/lib/server/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ graderId: string }> },
) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const { graderId } = await params;
    const input = updateGraderRequestSchema.parse(await readJsonBody(request));
    const store = await getEvalOpsStore();
    return store.updateGrader(actor, { graderId, ...input });
  });
}
