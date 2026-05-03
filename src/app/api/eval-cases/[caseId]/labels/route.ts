import { type NextRequest } from "next/server";
import { handleApi, readJsonBody } from "@/lib/server/api";
import { getActorFromRequest } from "@/lib/server/auth";
import { upsertHumanLabelRequestSchema } from "@/lib/server/schemas";
import { getEvalOpsStore } from "@/lib/server/store";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const { caseId } = await params;
    const input = upsertHumanLabelRequestSchema.parse(await readJsonBody(request));
    const store = await getEvalOpsStore();
    return store.upsertHumanLabel(actor, { evalCaseId: caseId, ...input });
  });
}
