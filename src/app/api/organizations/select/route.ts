import { type NextRequest, NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server/auth";
import { handleApi, readJsonBody } from "@/lib/server/api";
import { organizationSelectRequestSchema } from "@/lib/server/schemas";
import { getEvalOpsStore } from "@/lib/server/store";

export async function POST(request: NextRequest) {
  const response = await handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const input = organizationSelectRequestSchema.parse(await readJsonBody(request));
    const store = await getEvalOpsStore();
    await store.getWorkspaceState({ ...actor, organizationId: input.organizationId });
    return { organizationId: input.organizationId };
  });
  if (response instanceof NextResponse && response.status < 400) {
    const body = await response.clone().json();
    const organizationId = body?.data?.organizationId;
    if (organizationId) {
      response.cookies.set("evalops_org_id", organizationId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }
  }
  return response;
}
