import { type NextRequest } from "next/server";
import { getActorFromRequest } from "@/lib/server/auth";
import { handleApi } from "@/lib/server/api";
import { getEvalOpsStore } from "@/lib/server/store";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const { token } = await params;
    const store = await getEvalOpsStore();
    return store.acceptOrganizationInvitation(actor, token);
  });
}
