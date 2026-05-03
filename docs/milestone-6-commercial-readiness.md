# Milestone 6 Commercial Readiness

Milestone 6 prepares EvalOps Copilot for a limited commercial launch of the Eval Debt Audit workflow. The goal is not broad self-serve scale yet; it is a credible, supportable, counsel-reviewed private MVP that can be sold, onboarded, operated, and escalated with clear expectations.

## Public Surfaces

Public launch pages now exist for:

- `/terms`
- `/privacy`
- `/dpa`
- `/subprocessors`
- `/contact`

These pages are practical placeholders and must be reviewed by counsel before being treated as binding customer terms. They intentionally describe customer-owned data, limited private MVP scope, processor posture, expected subprocessors, support channels, and incident escalation without pretending that final legal language is complete.

## Route Access Note

The legal and contact pages should be accessible without authentication. The auth proxy public route allowlist must include:

- `/terms`
- `/privacy`
- `/dpa`
- `/subprocessors`
- `/contact`

The app shell public-route bypass should be updated in the same way so public visitors see the standalone public layout instead of the authenticated workspace shell.

## Environments

Production and preview environments should be intentionally separated.

Required production app environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_AUDIT_MODEL`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `EVALOPS_SMOKE_TOKEN`

Commercial launch additions:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STARTER_PRICE_ID`
- `STRIPE_GROWTH_PRICE_ID`
- `SENTRY_DSN` if Sentry is enabled
- `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` if PostHog is enabled

`EVALOPS_TEST_MODE` should be absent or set to `0` in hosted preview and production environments.

## Stripe Setup

Stripe should remain disabled until the commercial terms and order flow are approved.

Before enabling billing:

- Create separate Stripe test and live accounts or modes.
- Define recurring products and prices for Starter and Growth.
- Use Stripe Checkout for subscription start and Stripe Customer Portal for customer-managed billing.
- Configure tax, invoice numbering, receipts, refund policy, and customer billing contacts.
- Store Stripe keys only in Vercel environment variables.
- Add billing copy to customer agreements before charging customers.

## Webhooks

No billing webhook should be considered production-ready until it is idempotent, logged, and tested against Stripe test events.

Expected Stripe events when billing is added:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Webhook requirements:

- Verify Stripe signatures with `STRIPE_WEBHOOK_SECRET`.
- Record processed event ids to prevent duplicate effects.
- Avoid granting workspace access solely from an unverified client redirect.
- Keep payment metadata minimal and avoid storing payment card data.

## Support and Escalation

Before launch, confirm real operational channels for:

- product support;
- onboarding and commercial questions;
- billing;
- privacy and deletion requests;
- security and incident escalation.

Recommended placeholder addresses from the public contact page must be replaced with real monitored mailboxes or support tooling before customer distribution.

Incident escalation should capture:

- organization and project;
- affected users;
- relevant timestamps;
- suspected data involvement;
- request ids, export ids, or audit event ids;
- customer communications owner;
- remediation owner.

## Counsel Review

Counsel should review and approve:

- Terms of Service;
- Privacy Notice;
- Data Processing Addendum;
- subprocessor list and notice process;
- data retention and deletion commitments;
- incident notice commitments;
- AI vendor data-use commitments;
- payment, refund, and cancellation language;
- order form or statement-of-work template.

Do not enable broad self-serve signup, public billing, or customer-facing legal acceptance until this review is complete.

## Launch Readiness

Commercial launch is ready when:

- production smoke passes against the intended deployment;
- legal/contact pages are public and linked from relevant entry points;
- Supabase, OpenAI, Inngest, Vercel, and Stripe environments are confirmed;
- Stripe test billing has been exercised if billing is included;
- support and escalation channels are monitored;
- the subprocessor list matches actual production vendors;
- counsel has approved legal documents;
- the founder/operator has a rollback and customer communication plan.
