import { type NextRequest } from "next/server";
import { getActorFromRequest } from "@/lib/server/auth";
import { handleApi, readJsonBody } from "@/lib/server/api";
import { evallerWorkspaceInputSchema } from "@/lib/evaller/schemas";
import { getEvallerStore } from "@/lib/evaller/store";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    return getEvallerStore().getWorkspace(actor);
  });
}

export async function PUT(request: NextRequest) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const input = evallerWorkspaceInputSchema.parse(await readJsonBody(request));
    return getEvallerStore().saveWorkspace(actor, input);
  });
}
