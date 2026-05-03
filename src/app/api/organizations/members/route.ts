import { type NextRequest } from "next/server";
import { getActorFromRequest } from "@/lib/server/auth";
import { handleApi } from "@/lib/server/api";
import { getEvalOpsStore } from "@/lib/server/store";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const store = await getEvalOpsStore();
    const state = await store.ensureWorkspace(actor);
    return { members: state.members, invitations: state.invitations };
  });
}
