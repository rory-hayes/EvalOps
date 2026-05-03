import { LegalPage } from "@/components/legal-page";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="Commercial placeholder terms for the EvalOps Copilot private MVP and Eval Debt Audit workflow."
      updated="May 3, 2026"
      sections={[
        {
          title: "Service scope",
          body: "EvalOps Copilot helps teams review AI workflow traces, generate starter eval assets, configure graders, evaluate prompt changes, and prepare audit reports. The private MVP may include mocked or service-assisted workflows while production integrations are finalized.",
        },
        {
          title: "Customer data ownership",
          items: [
            "Customers retain ownership of prompts, uploaded traces, requirements, policies, known failures, and other materials submitted to EvalOps Copilot.",
            "EvalOps Copilot may process customer data to provide the service, generate derived eval artifacts, troubleshoot support issues, and maintain security and reliability.",
            "Customers are responsible for ensuring they have the rights and permissions needed to upload data into the service.",
          ],
        },
        {
          title: "Acceptable use",
          items: [
            "Do not submit unlawful content, secrets, payment card data, medical records, or other regulated data unless a written agreement explicitly permits it.",
            "Do not attempt to bypass authentication, tenant isolation, rate limits, retention controls, or security monitoring.",
            "Use generated recommendations as decision support. Customers remain responsible for validating evals, graders, prompts, routing rules, and reports before production use.",
          ],
        },
        {
          title: "Payments and commercial terms",
          body: "Stripe is the intended billing provider for paid plans and invoices. Until billing is enabled, paid audit engagements should be governed by a signed order form, statement of work, or other written commercial agreement.",
        },
        {
          title: "Availability and changes",
          body: "The private MVP is provided for limited evaluation and early customer workflows. Features, data models, integrations, and availability commitments may change before general availability unless a signed agreement says otherwise.",
        },
        {
          title: "Third-party services",
          body: "The service may rely on vendors such as Supabase, OpenAI, Inngest, Vercel, Stripe, Sentry, and PostHog. Vendor usage depends on the deployed environment and enabled features.",
        },
        {
          title: "Disclaimers",
          body: "EvalOps Copilot is not legal, compliance, security, financial, or professional advice. Counsel should review these placeholder terms and any customer-facing commitments before launch.",
        },
      ]}
      aside={{
        title: "Review required",
        body: "Replace this placeholder with counsel-approved terms before self-serve signup, billing, or broad customer distribution.",
        links: [
          { href: "/privacy", label: "Privacy notice" },
          { href: "/dpa", label: "Data processing addendum" },
        ],
      }}
    />
  );
}
