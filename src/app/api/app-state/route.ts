import { type NextRequest } from "next/server";
import { getActorFromRequest } from "@/lib/server/auth";
import { handleApi } from "@/lib/server/api";
import { getEvalOpsStore } from "@/lib/server/store";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const store = await getEvalOpsStore();
    const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
    return store.ensureWorkspace(actor).then(() => store.getWorkspaceState(actor, projectId));
  });
}
