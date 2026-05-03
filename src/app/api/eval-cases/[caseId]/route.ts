import { type NextRequest } from "next/server";
import { getActorFromRequest } from "@/lib/server/auth";
import { handleApi, readJsonBody } from "@/lib/server/api";
import { updateEvalCaseRequestSchema } from "@/lib/server/schemas";
import { getEvalOpsStore } from "@/lib/server/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const { caseId } = await params;
    const input = updateEvalCaseRequestSchema.parse(await readJsonBody(request));
    const store = await getEvalOpsStore();
    return store.updateEvalCase(actor, { caseId, ...input });
  });
}
