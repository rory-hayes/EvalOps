import { type NextRequest } from "next/server";
import { getActorFromRequest } from "@/lib/server/auth";
import { handleApi, readJsonBody } from "@/lib/server/api";
import { createReviewCommentRequestSchema } from "@/lib/evaller/schemas";
import { getEvallerStore } from "@/lib/evaller/store";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const { runId } = await params;
    const input = createReviewCommentRequestSchema.parse(await readJsonBody(request));
    return getEvallerStore().addReviewComment(actor, runId, input.body);
  });
}
