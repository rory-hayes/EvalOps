import { type NextRequest } from "next/server";
import { handleApi } from "@/lib/server/api";
import { getEvalOpsStore } from "@/lib/server/store";
import { constructStripeWebhookEvent, syncBillingFromStripeEvent } from "@/lib/server/stripe";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const body = await request.text();
    const event = constructStripeWebhookEvent(body, request.headers.get("stripe-signature"));
    const store = await getEvalOpsStore();
    return syncBillingFromStripeEvent(store, event);
  });
}
