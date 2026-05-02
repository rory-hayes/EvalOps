import { Database, KeyRound, LockKeyhole, PlugZap, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, Button, Card, IconTile, PageHeader } from "@/components/primitives";

export default function SettingsPage() {
  const privacyDefaults: Array<{
    title: string;
    detail: string;
    enabled: boolean;
    icon: LucideIcon;
  }> = [
    {
      title: "PII redaction",
      detail: "Detect and redact likely personal data before storage.",
      enabled: true,
      icon: ShieldCheck,
    },
    {
      title: "Derived evals only",
      detail: "Keep generated eval assets as the durable artifact.",
      enabled: false,
      icon: Database,
    },
    {
      title: "Short raw trace retention",
      detail: "Delete source traces after 30 days by default.",
      enabled: true,
      icon: LockKeyhole,
    },
    {
      title: "Provider store:false",
      detail: "Send storage-minimizing flags where supported.",
      enabled: true,
      icon: KeyRound,
    },
  ];

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure workspace defaults, privacy controls, and service connection readiness."
      />

      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <Card className="p-4">
          <h2 className="text-base font-semibold text-slate-950">Workspace</h2>
          <div className="mt-5 space-y-3">
            {[
              ["General", "Project naming, owner, timezone"],
              ["Privacy", "Retention and redaction defaults"],
              ["Integrations", "Supabase, Inngest, OpenAI, Clerk"],
              ["Billing", "Pilot billing placeholder"],
            ].map(([title, detail], index) => (
              <button
                key={title}
                className={
                  index === 1
                    ? "w-full rounded-[8px] bg-blue-50 p-3 text-left"
                    : "w-full rounded-[8px] p-3 text-left hover:bg-slate-50"
                }
              >
                <span className={index === 1 ? "block text-sm font-semibold text-blue-700" : "block text-sm font-semibold text-slate-800"}>
                  {title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Privacy defaults</h2>
                <p className="mt-2 text-sm text-slate-500">
                  These defaults apply to new projects and can be adjusted during trace import.
                </p>
              </div>
              <Badge tone="green">MVP ready</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {privacyDefaults.map(({ title, detail, enabled, icon: Icon }) => (
                <div key={title} className="rounded-[8px] border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <IconTile icon={Icon} tone={enabled ? "green" : "slate"} />
                    <span className={enabled ? "relative h-6 w-11 rounded-full bg-blue-600" : "relative h-6 w-11 rounded-full bg-slate-200"}>
                      <span className={enabled ? "absolute right-1 top-1 h-4 w-4 rounded-full bg-white" : "absolute left-1 top-1 h-4 w-4 rounded-full bg-white"} />
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-slate-950">Service connection plan</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Milestone 1 uses realistic mocked data and typed boundaries. These service adapters are installed and ready to be wired once live credentials are available.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["Clerk", "Organizations and roles", "Configured later"],
                ["Supabase", "Postgres and Storage", "Schema-ready"],
                ["Inngest", "Durable audit pipeline", "Event map drafted"],
                ["OpenAI", "Structured generation", "Adapter drafted"],
              ].map(([name, detail, status]) => (
                <div key={name} className="rounded-[8px] border border-slate-200 p-4">
                  <IconTile icon={PlugZap} tone="blue" />
                  <h3 className="mt-4 text-sm font-semibold text-slate-900">{name}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
                  <Badge tone="blue" className="mt-4">{status}</Badge>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <Button>Save settings</Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
