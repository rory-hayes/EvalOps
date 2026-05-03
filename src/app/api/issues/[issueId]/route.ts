import { type NextRequest } from "next/server";
import { getActorFromRequest } from "@/lib/server/auth";
import { handleApi, readJsonBody } from "@/lib/server/api";
import { updateIssueRequestSchema } from "@/lib/server/schemas";
import { getEvalOpsStore } from "@/lib/server/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> },
) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const { issueId } = await params;
    const input = updateIssueRequestSchema.parse(await readJsonBody(request));
    const store = await getEvalOpsStore();
    return store.updateIssue(actor, { issueId, ...input });
  });
}
