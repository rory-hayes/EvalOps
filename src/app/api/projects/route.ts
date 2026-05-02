import { type NextRequest } from "next/server";
import { getActorFromRequest } from "@/lib/server/auth";
import { handleApi } from "@/lib/server/api";
import { createProjectRequestSchema } from "@/lib/server/schemas";
import { getEvalOpsStore } from "@/lib/server/store";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const store = await getEvalOpsStore();
    await store.ensureWorkspace(actor);
    return store.getWorkspaceState(actor);
  });
}

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const input = createProjectRequestSchema.parse(await request.json());
    const store = await getEvalOpsStore();
    return store.createProject(actor, input);
  });
}
