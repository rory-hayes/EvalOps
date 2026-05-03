import { LegalPage } from "@/components/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Notice"
      description="Placeholder privacy notice describing how EvalOps Copilot expects to handle account, workspace, trace, and derived audit data."
      updated="May 3, 2026"
      sections={[
        {
          title: "Data we collect",
          items: [
            "Account and workspace details such as name, email, organization membership, project names, and authentication metadata.",
            "Customer-provided workflow content such as prompts, trace files, policy excerpts, requirements, known failures, review comments, and settings.",
            "Derived artifacts such as eval cases, grader definitions, failure clusters, prompt candidates, routing recommendations, cache recommendations, reports, exports, and operation receipts.",
            "Operational telemetry such as audit events, request metadata, error diagnostics, and usage analytics where enabled.",
          ],
        },
        {
          title: "How we use data",
          items: [
            "Provide the Eval Debt Audit workflow and maintain project-specific eval assets.",
            "Support redaction, retention, export, deletion, reliability, security, abuse prevention, and customer support workflows.",
            "Improve product quality using aggregated or de-identified operational learnings, subject to the final customer agreement.",
          ],
        },
        {
          title: "Customer-owned data",
          body: "Customer data remains customer-owned. EvalOps Copilot is designed to favor minimal raw retention, redaction controls, and derived artifacts that can be reviewed, exported, and deleted through product or support workflows.",
        },
        {
          title: "Vendors and processors",
          body: "The current commercial architecture may use Supabase for auth, database, and storage; OpenAI for structured generation; Inngest for background workflows; Vercel for hosting; Stripe for billing; and Sentry/PostHog for observability and analytics when enabled.",
        },
        {
          title: "Retention and deletion",
          body: "Project settings and backend operations are intended to support retention-aware raw upload handling, full project export, and project deletion receipts. Customer-specific retention commitments should be finalized in the DPA or order form.",
        },
        {
          title: "Security",
          body: "EvalOps Copilot uses tenant-scoped access controls, private storage buckets, server-side vendor credentials, and audit trails. Security commitments, incident notice timing, and data residency terms require legal and security review before launch.",
        },
        {
          title: "Contact",
          body: "Privacy requests, deletion requests, and security escalations should be routed through the contact page until a dedicated privacy mailbox and ticketing workflow are finalized.",
        },
      ]}
      aside={{
        title: "Privacy launch posture",
        body: "Use this page as a working draft only. Confirm controller/processor roles, retention periods, analytics settings, and data transfer terms with counsel.",
        links: [
          { href: "/subprocessors", label: "Subprocessor list" },
          { href: "/contact", label: "Privacy contact" },
        ],
      }}
    />
  );
}
