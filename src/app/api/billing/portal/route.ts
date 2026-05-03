import { type NextRequest } from "next/server";
import { getActorFromRequest, ApiError } from "@/lib/server/auth";
import { handleApi, readJsonBody } from "@/lib/server/api";
import { z } from "zod";
import { getEvalOpsStore } from "@/lib/server/store";
import { createBillingPortalSession } from "@/lib/server/stripe";
import { canAccessBilling } from "@/lib/server/commercial/plans";

const portalRequestSchema = z.object({
  returnUrl: z.string().url().max(2000),
});

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const input = portalRequestSchema.parse(await readJsonBody(request));
    const store = await getEvalOpsStore();
    const state = await store.ensureWorkspace(actor);
    if (!canAccessBilling(state.membership.role)) {
      throw new ApiError(403, "Only organization owners can manage billing.", "forbidden");
    }
    return createBillingPortalSession({ billing: state.billing.billing, returnUrl: input.returnUrl });
  });
}
