import { type NextRequest } from "next/server";
import { getActorFromRequest } from "@/lib/server/auth";
import { handleApi } from "@/lib/server/api";
import { getEvallerStore } from "@/lib/evaller/store";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ promptVersionId: string }> },
) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const { promptVersionId } = await params;
    return getEvallerStore().restorePromptVersion(actor, promptVersionId);
  });
}
