import { Download, FileText, Share2 } from "lucide-react";
import { Badge, Button, Card, IconTile, PageHeader, ProgressBar } from "@/components/primitives";
import {
  coverageByIntent,
  project,
  recommendedActions,
  reportSections,
} from "@/data/evalops";
import { computeAuditReadiness } from "@/lib/domain/audit";

const readiness = computeAuditReadiness({
  intentCoverage: 92.6,
  judgeCalibration: 92,
  regressionPassRate: 94.3,
  staleEvalRisk: "medium",
});

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Audit Report"
        description="Boardroom-ready summary of evaluation health, risks, and recommended next actions."
        actions={
          <>
            <Button variant="secondary">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button>
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </>
        }
        meta={
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
            <span>
              Project <strong className="ml-2 text-slate-700">{project.name}</strong>
            </span>
            <span>
              Report period <strong className="ml-2 text-slate-700">{project.dateRange}</strong>
            </span>
            <span>
              Generated <strong className="ml-2 text-slate-700">{project.lastRun}</strong>
            </span>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <IconTile icon={FileText} tone="blue" className="h-12 w-12" />
            <div>
              <p className="text-sm font-semibold text-slate-500">Eval health score</p>
              <h2 className="mt-1 text-4xl font-semibold text-slate-950">{readiness.score}</h2>
            </div>
          </div>
          <Badge tone="green" className="mt-5">{readiness.label}</Badge>
          <p className="mt-4 text-sm leading-6 text-slate-600">{readiness.recommendation}</p>
          <div className="mt-6 space-y-4">
            {[
              ["Intent coverage", 92.6],
              ["Regression pass rate", 94.3],
              ["Judge calibration", 92],
              ["Privacy readiness", 88],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-slate-700">{label}</span>
                  <span className="font-semibold text-slate-950">{value}%</span>
                </div>
                <ProgressBar value={Number(value)} tone="green" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Eval Debt Audit - Executive Report</h2>
              <p className="mt-2 text-sm text-slate-500">
                A concise artifact for product, engineering, and leadership review.
              </p>
            </div>
            <Badge tone="blue">Ready for review</Badge>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {reportSections.map((section) => (
              <div key={section.title} className="rounded-[8px] border border-slate-200 p-4">
                <h3 className="text-base font-semibold text-slate-950">{section.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{section.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[8px] border border-blue-100 bg-blue-50 p-4">
            <h3 className="text-base font-semibold text-blue-900">Recommended decision</h3>
            <p className="mt-2 text-sm leading-6 text-blue-900/75">
              Approve Candidate B for a controlled rollout after adding escalation evals,
              recalibrating the Tone Judge, and reviewing refund routing.
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Coverage Map</h2>
          <div className="mt-5 grid gap-3">
            {coverageByIntent.slice(0, 6).map((intent) => (
              <div key={intent.intent} className="grid grid-cols-[150px_1fr_52px] items-center gap-3 text-sm">
                <span className="font-medium text-slate-700">{intent.intent}</span>
                <div className="flex h-3 overflow-hidden rounded-sm bg-slate-100">
                  <div className="bg-emerald-400" style={{ width: `${intent.covered}%` }} />
                  <div className="bg-amber-300" style={{ width: `${intent.partial}%` }} />
                  <div className="bg-red-300" style={{ width: `${intent.missing}%` }} />
                </div>
                <span className="text-right font-semibold text-slate-950">{intent.total}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Prioritized Recommendations</h2>
          <div className="mt-4 space-y-4">
            {recommendedActions.map((action, index) => (
              <div key={action.title} className="grid grid-cols-[32px_1fr_auto] gap-3 rounded-[8px] border border-slate-200 p-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-slate-50 text-sm font-semibold text-slate-600">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{action.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{action.detail}</p>
                </div>
                <Badge tone={index === 0 ? "red" : "amber"}>{action.impact}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {[
          ["Starter eval pack", "124 curated cases across golden, regression, edge, and safety sets.", "Export JSON"],
          ["Grader definitions", "6 configured graders with threshold and calibration metadata.", "Export YAML"],
          ["Failure clusters", "Top clusters mapped to prompt, routing, and policy recommendations.", "Export CSV"],
        ].map(([title, detail, action]) => (
          <Card key={title} className="p-5">
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{detail}</p>
            <Button variant="secondary" className="mt-5">{action}</Button>
          </Card>
        ))}
      </div>
    </>
  );
}
