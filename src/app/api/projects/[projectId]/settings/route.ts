import { type NextRequest } from "next/server";
import { handleApi, readJsonBody } from "@/lib/server/api";
import { getActorFromRequest } from "@/lib/server/auth";
import { updateProjectSettingsRequestSchema } from "@/lib/server/schemas";
import { getEvalOpsStore } from "@/lib/server/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const { projectId } = await params;
    const input = updateProjectSettingsRequestSchema.parse(await readJsonBody(request));
    const store = await getEvalOpsStore();
    return store.updateProjectSettings(actor, projectId, input);
  });
}
