import Stripe from "stripe";
import { ApiError } from "./auth";
import { requireEnv } from "./env";
import type { BillingPlanId, BillingStatus } from "./commercial/plans";
import type { EvalOpsStore, OrganizationBilling } from "./types";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (!stripeClient) {
    stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  }
  return stripeClient;
}

export function getStripePriceId(planId: BillingPlanId) {
  return requireEnv(planId === "starter" ? "STRIPE_STARTER_PRICE_ID" : "STRIPE_GROWTH_PRICE_ID");
}

export function planIdFromPriceId(priceId?: string | null): BillingPlanId {
  if (priceId && priceId === process.env.STRIPE_GROWTH_PRICE_ID) return "growth";
  return "starter";
}

export async function createBillingCheckoutSession(input: {
  store: EvalOpsStore;
  billing: OrganizationBilling;
  organizationId: string;
  userEmail?: string;
  planId: BillingPlanId;
  returnUrl: string;
}) {
  const stripe = getStripeClient();
  const customerId =
    input.billing.stripeCustomerId ||
    (await stripe.customers.create({
      email: input.userEmail,
      metadata: { organizationId: input.organizationId },
    })).id;

  if (!input.billing.stripeCustomerId) {
    await input.store.updateOrganizationBilling(
      { userId: "stripe_system", organizationId: input.organizationId },
      { organizationId: input.organizationId, stripeCustomerId: customerId },
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: getStripePriceId(input.planId), quantity: 1 }],
    success_url: input.returnUrl,
    cancel_url: input.returnUrl,
    subscription_data: {
      metadata: { organizationId: input.organizationId, planId: input.planId },
    },
    metadata: { organizationId: input.organizationId, planId: input.planId },
  });

  if (!session.url) {
    throw new ApiError(502, "Stripe did not return a checkout URL.", "stripe_checkout_failed");
  }

  return { url: session.url };
}

export async function createBillingPortalSession(input: { billing: OrganizationBilling; returnUrl: string }) {
  if (!input.billing.stripeCustomerId) {
    throw new ApiError(409, "Start billing before opening the customer portal.", "stripe_customer_missing");
  }
  const session = await getStripeClient().billingPortal.sessions.create({
    customer: input.billing.stripeCustomerId,
    return_url: input.returnUrl,
  });
  return { url: session.url };
}

export function constructStripeWebhookEvent(body: string, signature: string | null) {
  if (!signature) {
    throw new ApiError(400, "Stripe signature is required.", "stripe_signature_missing");
  }
  try {
    return getStripeClient().webhooks.constructEvent(body, signature, requireEnv("STRIPE_WEBHOOK_SECRET"));
  } catch {
    throw new ApiError(400, "Stripe webhook signature verification failed.", "stripe_signature_invalid");
  }
}

export function billingStatusFromStripe(status?: string | null): BillingStatus {
  if (status === "trialing") return "trialing";
  if (status === "active") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled") return "canceled";
  if (status === "incomplete" || status === "incomplete_expired") return "incomplete";
  return "setup_required";
}

export async function syncBillingFromStripeEvent(store: EvalOpsStore, event: Stripe.Event) {
  if (await store.hasProcessedStripeEvent(event.id)) return { duplicate: true };

  await store.recordStripeEvent({
    id: event.id,
    type: event.type,
    livemode: event.livemode,
    payload: JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
  });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const organizationId = session.metadata?.organizationId;
    if (organizationId && typeof session.customer === "string") {
      await store.updateOrganizationBilling(
        { userId: "stripe_system", organizationId },
        {
          organizationId,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : undefined,
          status: "trialing",
          planId: session.metadata?.planId === "growth" ? "growth" : "starter",
        },
      );
    }
  }

  if (event.type.startsWith("customer.subscription.")) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = typeof subscription.customer === "string" ? subscription.customer : undefined;
    const billing = customerId ? await store.findOrganizationBillingByStripeCustomer(customerId) : undefined;
    const organizationId = subscription.metadata?.organizationId || billing?.organizationId;
    const priceId = subscription.items.data[0]?.price.id;
    if (organizationId) {
      await store.updateOrganizationBilling(
        { userId: "stripe_system", organizationId },
        {
          organizationId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          planId: planIdFromPriceId(priceId),
          status: billingStatusFromStripe(subscription.status),
          stripeCurrentPeriodStart: subscription.items.data[0]?.current_period_start
            ? new Date(subscription.items.data[0].current_period_start * 1000).toISOString()
            : undefined,
          stripeCurrentPeriodEnd: subscription.items.data[0]?.current_period_end
            ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
            : undefined,
          trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : undefined,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      );
    }
  }

  if (event.type === "invoice.payment_failed" || event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : undefined;
    const billing = customerId ? await store.findOrganizationBillingByStripeCustomer(customerId) : undefined;
    if (billing) {
      await store.updateOrganizationBilling(
        { userId: "stripe_system", organizationId: billing.organizationId },
        {
          organizationId: billing.organizationId,
          status: event.type === "invoice.payment_failed" ? "past_due" : "active",
        },
      );
    }
  }

  return { duplicate: false };
}
