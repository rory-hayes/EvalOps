import { LegalPage } from "@/components/legal-page";

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact and Escalation"
      description="Support, commercial, privacy, and incident escalation guidance for EvalOps Copilot private MVP customers."
      updated="May 3, 2026"
      reviewNote="This page is operational launch copy. Replace placeholder mailboxes and response targets with approved support channels before customer launch."
      sections={[
        {
          title: "Support",
          body: "For product support, include your organization name, project name, affected workflow, expected behavior, actual behavior, timestamps, and screenshots or export ids where relevant. Do not send raw secrets or unnecessary sensitive trace content by email.",
        },
        {
          title: "Commercial and onboarding",
          body: "For Eval Debt Audit scoping, onboarding, order forms, or billing questions, include the target workflow, team size, expected trace volume, desired audit timing, and any procurement or security review deadlines.",
        },
        {
          title: "Privacy requests",
          body: "For privacy, export, deletion, or retention requests, include the workspace, project, requesting user, and desired action. EvalOps Copilot is designed around customer-owned data and supportable export/deletion workflows.",
        },
        {
          title: "Security or incident escalation",
          items: [
            "Use the highest-priority customer support channel for suspected unauthorized access, tenant isolation issues, data exposure, or production availability incidents.",
            "Include a concise timeline, affected users or projects, relevant request ids or export ids, and whether customer data may be involved.",
            "EvalOps should acknowledge credible security or privacy incidents promptly, preserve logs, reduce exposure, and coordinate customer communications according to the final incident response plan.",
          ],
        },
        {
          title: "App access",
          body: "Signed-in users can return to the product dashboard for project review, exports, settings, and report workflows. Public visitors can return to the home page or sign in when they have private MVP access.",
          items: [
            "Open the product dashboard: /dashboard",
            "Sign in: /login",
            "Return home: /",
          ],
        },
      ]}
      aside={{
        title: "Placeholder contacts",
        body: "Recommended launch channels: support@evalops.example, security@evalops.example, privacy@evalops.example, and billing@evalops.example. Replace with real addresses before launch.",
        links: [
          { href: "/login", label: "Sign in" },
          { href: "/dashboard", label: "Open dashboard" },
        ],
      }}
    />
  );
}
