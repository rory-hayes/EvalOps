# Commercial Launch Checklist

Use this checklist before offering EvalOps Copilot to paying private MVP customers.

## Legal and Public Pages

- [ ] Counsel approved Terms of Service.
- [ ] Counsel approved Privacy Notice.
- [ ] Counsel approved Data Processing Addendum.
- [ ] Subprocessor list matches actual production vendors.
- [ ] Contact page uses real monitored support, security, privacy, and billing channels.
- [ ] Public legal routes are unauthenticated: `/terms`, `/privacy`, `/dpa`, `/subprocessors`, `/contact`.
- [ ] App shell treats those pages as public surfaces.

## Environment Configuration

- [ ] Production Supabase URL and publishable key are set.
- [ ] Production Supabase service credential is server-only.
- [ ] OpenAI key and audit model are set.
- [ ] Inngest event and signing keys are set.
- [ ] Readiness smoke token is set.
- [ ] `EVALOPS_TEST_MODE` is not enabled in production.
- [ ] Preview environment mirrors production env shape with non-production credentials where appropriate.
- [ ] Secrets are not committed to the repository or exposed through `NEXT_PUBLIC_` names unless intentionally public.

## Stripe and Billing

- [ ] Stripe test mode products and prices are configured.
- [ ] Live mode products and prices are approved.
- [ ] Billing model is decided: invoice, Payment Link, Checkout, subscription, or service agreement.
- [ ] Tax, receipt, refund, and cancellation policies are documented.
- [ ] Stripe keys are configured in Vercel.
- [ ] `STRIPE_STARTER_PRICE_ID` and `STRIPE_GROWTH_PRICE_ID` match the intended live prices.
- [ ] Webhook endpoint is signature-verified.
- [ ] Webhook events are idempotent.
- [ ] Test events cover successful payment, failed payment, subscription changes, and cancellation.
- [ ] Customer access is not granted from an unverified redirect alone.

## Webhooks and Operations

- [ ] Inngest endpoint is reachable in production.
- [ ] Stripe webhook endpoint is reachable if billing is enabled.
- [ ] Health and readiness endpoints return expected results.
- [ ] Vercel logs, Inngest runs, Supabase records, and Stripe events can be correlated during support.
- [ ] Sentry is enabled or an equivalent error-monitoring plan exists.
- [ ] PostHog is enabled only after analytics capture and privacy copy are approved.

## Data Protection

- [ ] Raw trace retention posture is documented.
- [ ] Redaction controls are visible in the product workflow.
- [ ] Full project export is verified.
- [ ] Project deletion receipt workflow is verified.
- [ ] Support guidance tells users not to email secrets or unnecessary raw trace content.
- [ ] Vendor AI data-use settings are documented.
- [ ] Subprocessor DPAs and security materials are collected.

## Launch Verification

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Production smoke against preview deployment.
- [ ] Production smoke against production deployment.
- [ ] Public legal pages load without authentication.
- [ ] Sign-in, project creation, trace import, generated artifacts, export, and deletion flows are verified.
- [ ] Rollback plan is documented.

## Support and Incident Response

- [ ] Support owner is assigned.
- [ ] Security escalation owner is assigned.
- [ ] Privacy request owner is assigned.
- [ ] Billing owner is assigned.
- [ ] Customer acknowledgement targets are defined.
- [ ] Incident notes template captures organization, project, users, timestamps, data involvement, and remediation.
- [ ] Customer communication templates exist for outage, security, privacy, and billing issues.

## Final Go/No-Go

- [ ] Founder/operator accepts known private MVP limits.
- [ ] Counsel approval is complete.
- [ ] First customer onboarding plan is ready.
- [ ] Monitoring and support are staffed for the launch window.
- [ ] Payment collection path is approved or intentionally deferred.
