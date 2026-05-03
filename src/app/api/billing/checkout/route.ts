import { type NextRequest } from "next/server";
import { getActorFromRequest } from "@/lib/server/auth";
import { handleApi, readJsonBody } from "@/lib/server/api";
import { billingCheckoutRequestSchema } from "@/lib/server/schemas";
import { getEvalOpsStore } from "@/lib/server/store";
import { createBillingCheckoutSession } from "@/lib/server/stripe";
import { canAccessBilling } from "@/lib/server/commercial/plans";
import { ApiError } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const input = billingCheckoutRequestSchema.parse(await readJsonBody(request));
    const store = await getEvalOpsStore();
    const state = await store.ensureWorkspace(actor);
    if (!canAccessBilling(state.membership.role)) {
      throw new ApiError(403, "Only organization owners can manage billing.", "forbidden");
    }
    return createBillingCheckoutSession({
      store,
      billing: state.billing.billing,
      organizationId: state.organization.id,
      userEmail: state.user.email,
      planId: input.planId,
      returnUrl: input.returnUrl,
    });
  });
}
