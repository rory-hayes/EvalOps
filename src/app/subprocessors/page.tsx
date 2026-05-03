import { LegalPage } from "@/components/legal-page";

export default function SubprocessorsPage() {
  return (
    <LegalPage
      title="Subprocessors"
      description="Working list of third-party providers expected to support EvalOps Copilot commercial operations."
      updated="May 3, 2026"
      sections={[
        {
          title: "Current expected subprocessors",
          items: [
            "Supabase: authentication, Postgres database, private storage, and related platform services.",
            "OpenAI: structured generation for eval cases, graders, reports, prompt analysis, and recommendation workflows.",
            "Inngest: background job orchestration for trace import and audit processing.",
            "Vercel: application hosting, deployment, routing, and runtime infrastructure.",
            "Stripe: billing, invoicing, checkout, subscriptions, and payment operations when billing is enabled.",
            "Sentry: application error monitoring and incident diagnostics if enabled.",
            "PostHog: product analytics, funnel analysis, and usage telemetry if enabled.",
          ],
        },
        {
          title: "Customer data handled",
          body: "Depending on the feature, vendors may process account details, project metadata, uploaded trace content, generated artifacts, operational logs, billing metadata, or diagnostics. Raw customer traces should be minimized and retained according to customer settings and final agreements.",
        },
        {
          title: "Notice and objections",
          body: "Before general availability, define the customer notice period, objection process, emergency replacement process, and historical archive for subprocessor changes.",
        },
        {
          title: "Vendor review",
          items: [
            "Confirm vendor DPAs, security documentation, data residency options, and AI data-use settings.",
            "Record which vendors are active in production, preview, development, and test environments.",
            "Avoid enabling analytics or monitoring that captures raw sensitive customer content without an explicit review.",
          ],
        },
      ]}
      aside={{
        title: "Active list needed",
        body: "Before launch, replace this expected list with the actual production vendor list and link each vendor's legal/security documentation.",
        links: [
          { href: "/dpa", label: "DPA placeholder" },
          { href: "/privacy", label: "Privacy notice" },
        ],
      }}
    />
  );
}
