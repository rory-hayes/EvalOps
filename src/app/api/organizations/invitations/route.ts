import { type NextRequest } from "next/server";
import { getActorFromRequest } from "@/lib/server/auth";
import { handleApi, readJsonBody } from "@/lib/server/api";
import { createOrganizationInvitationRequestSchema } from "@/lib/server/schemas";
import { getEvalOpsStore } from "@/lib/server/store";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const input = createOrganizationInvitationRequestSchema.parse(await readJsonBody(request));
    const store = await getEvalOpsStore();
    const created = await store.createOrganizationInvitation(actor, input);
    return {
      invitation: created.invitation,
      acceptUrl: `${request.nextUrl.origin}/invite/${created.token}`,
      token: created.token,
    };
  });
}
