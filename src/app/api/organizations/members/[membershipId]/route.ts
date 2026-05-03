import { type NextRequest } from "next/server";
import { getActorFromRequest } from "@/lib/server/auth";
import { handleApi, readJsonBody } from "@/lib/server/api";
import { updateOrganizationMemberRequestSchema } from "@/lib/server/schemas";
import { getEvalOpsStore } from "@/lib/server/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const { membershipId } = await params;
    const input = updateOrganizationMemberRequestSchema.parse(await readJsonBody(request));
    const store = await getEvalOpsStore();
    return store.updateOrganizationMember(actor, { membershipId, role: input.role });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const { membershipId } = await params;
    const store = await getEvalOpsStore();
    await store.removeOrganizationMember(actor, membershipId);
    return { removed: true };
  });
}
