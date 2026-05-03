import { LegalPage } from "@/components/legal-page";

export default function DpaPage() {
  return (
    <LegalPage
      title="Data Processing Addendum"
      description="Placeholder DPA summary for customers evaluating EvalOps Copilot as a processor of customer-owned workflow data."
      updated="May 3, 2026"
      sections={[
        {
          title: "Roles",
          body: "For most customer projects, the customer is expected to act as controller or business and EvalOps Copilot as processor or service provider for customer data submitted to the service. Final role language must be confirmed by counsel.",
        },
        {
          title: "Processing instructions",
          items: [
            "Process customer data only to provide, secure, support, and improve the contracted service.",
            "Generate derived eval artifacts, reports, and recommendations based on customer-provided inputs and customer-approved settings.",
            "Support export, deletion, retention, and incident response workflows according to the final agreement.",
          ],
        },
        {
          title: "Categories of data",
          items: [
            "Business contact and account data for authorized users.",
            "AI workflow data such as prompts, traces, conversations, outputs, requirements, policies, and known failures.",
            "Derived audit data such as eval cases, graders, results, recommendations, reports, and audit logs.",
          ],
        },
        {
          title: "Subprocessors",
          body: "Expected subprocessors include Supabase, OpenAI, Inngest, Vercel, Stripe, Sentry, and PostHog where applicable. The active list and notice process should be maintained on the subprocessors page.",
        },
        {
          title: "Security measures",
          items: [
            "Tenant-aware access controls and private storage for customer uploads and exports.",
            "Server-only service credentials for Supabase, OpenAI, Inngest, Stripe, and other backend vendors.",
            "Audit events for security-relevant project operations, exports, deletion, and settings changes.",
            "Operational monitoring and incident escalation workflows appropriate for a private MVP.",
          ],
        },
        {
          title: "International transfers",
          body: "Data transfer mechanisms, regional hosting requirements, and SCC or equivalent terms need counsel review before serving customers with specific residency or cross-border transfer requirements.",
        },
        {
          title: "Deletion and return",
          body: "The product is intended to support full project export and project deletion receipts. Final deletion windows, backup retention, and support-assisted workflows should be contractually defined.",
        },
      ]}
      aside={{
        title: "DPA status",
        body: "This is a launch-planning placeholder, not a signed addendum. Attach counsel-approved DPA terms to paid customer agreements.",
        links: [
          { href: "/privacy", label: "Privacy notice" },
          { href: "/subprocessors", label: "Subprocessors" },
        ],
      }}
    />
  );
}
