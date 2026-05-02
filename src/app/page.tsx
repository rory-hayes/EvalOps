import { ChevronRight, Settings } from "lucide-react";
import { PassRateChart, Sparkline } from "@/components/charts";
import { Badge, Button, Card, IconTile, PageHeader } from "@/components/primitives";
import {
  coverageByIntent,
  evalRuns,
  failureClusters,
  healthMetrics,
  passRateSeries,
  project,
  recommendedActions,
} from "@/data/evalops";

const sparklineColors = {
  emerald: "#16a34a",
  violet: "#7c3aed",
  blue: "#2563eb",
  orange: "#f97316",
  red: "#ef4444",
};

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Eval Health Overview"
        actions={
          <Button variant="secondary">
            <Settings className="h-4 w-4" />
            Customize dashboard
          </Button>
        }
        meta={
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
            <span>
              Project <strong className="ml-2 font-medium text-slate-700">{project.name}</strong>
            </span>
            <span>
              Last run <strong className="ml-2 font-medium text-slate-700">{project.lastRun}</strong>
            </span>
            <span>
              Prompt version{" "}
              <strong className="ml-2 font-medium text-slate-700">{project.promptVersion}</strong>
            </span>
            <span>
              Model mix{" "}
              <strong className="ml-2 font-medium text-slate-700">
                {project.modelMix.join("  •  ")}
              </strong>
            </span>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {healthMetrics.map((metric) => (
          <Card key={metric.label} className="p-4">
            <div className="mb-5 flex items-center gap-3">
              <IconTile icon={metric.icon} tone={metric.color as never} />
              <span className="text-sm font-semibold text-slate-700">{metric.label}</span>
            </div>
            <div
              className={
                metric.tone === "danger"
                  ? "text-2xl font-semibold text-red-600"
                  : "text-2xl font-semibold text-slate-950"
              }
            >
              {metric.value}
            </div>
            <p className="mt-3 text-xs text-slate-500">{metric.delta}</p>
            <div className="mt-4">
              <Sparkline
                data={metric.sparkline}
                color={sparklineColors[metric.color as keyof typeof sparklineColors]}
              />
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1.15fr_0.85fr_0.75fr]">
        <Card className="p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950">Eval Pass Rate Over Time</h2>
            <Badge>Daily</Badge>
          </div>
          <PassRateChart data={passRateSeries} />
        </Card>

        <Card className="p-4">
          <h2 className="mb-4 text-base font-semibold text-slate-950">Coverage by Intent</h2>
          <div className="mb-4 flex gap-5 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-emerald-400" />
              Covered
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-amber-300" />
              Partial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-red-300" />
              Missing
            </span>
          </div>
          <div className="space-y-3">
            {coverageByIntent.map((row) => (
              <div key={row.intent} className="grid grid-cols-[110px_1fr_42px] items-center gap-3 text-sm">
                <span className="truncate text-slate-600">{row.intent}</span>
                <div className="flex h-3 overflow-hidden rounded-sm bg-slate-100">
                  <div className="bg-emerald-400" style={{ width: `${row.covered}%` }} />
                  <div className="bg-amber-300" style={{ width: `${row.partial}%` }} />
                  <div className="bg-red-300" style={{ width: `${row.missing}%` }} />
                </div>
                <span className="text-right font-semibold text-slate-700">{row.total}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-3">
            <h2 className="text-base font-semibold text-slate-950">Top Failure Clusters</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {failureClusters.map((cluster, index) => (
              <div key={cluster.label} className="grid grid-cols-[34px_1fr_auto] gap-3 p-3 text-sm">
                <Badge tone={cluster.tone as never}>{index + 1}</Badge>
                <span className="font-medium leading-4 text-slate-700">{cluster.label}</span>
                <span className="text-right text-xs text-slate-500">
                  {cluster.runs} runs
                  <strong className="block text-sm text-slate-950">{cluster.percent}</strong>
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 p-3 text-sm font-semibold text-blue-600">
            View all clusters <ChevronRight className="h-4 w-4" />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.65fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-base font-semibold text-slate-950">Recent Eval Runs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">Run ID</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Prompt version</th>
                  <th className="px-4 py-3">Model mix</th>
                  <th className="px-4 py-3">Dataset</th>
                  <th className="px-4 py-3">Pass rate</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {evalRuns.map((run) => (
                  <tr key={run.id}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600">{run.id}</td>
                    <td className="px-4 py-3 text-slate-600">{run.started}</td>
                    <td className="px-4 py-3 text-slate-700">{run.promptVersion}</td>
                    <td className="px-4 py-3 text-slate-700">GPT + AI + Gemini</td>
                    <td className="px-4 py-3 text-slate-600">{run.dataset}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{run.passRate}</td>
                    <td className="px-4 py-3">
                      <Badge tone={run.status === "Passed" ? "green" : "amber"}>{run.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm font-semibold text-blue-600">
            View all runs <ChevronRight className="h-4 w-4" />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-base font-semibold text-slate-950">Recommended Actions</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recommendedActions.map((action) => (
              <div key={action.title} className="grid grid-cols-[42px_1fr_16px] gap-3 p-4">
                <IconTile icon={action.icon} tone={action.color as never} />
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{action.title}</h3>
                    <Badge tone={action.color as never}>{action.impact}</Badge>
                  </div>
                  <p className="text-xs leading-5 text-slate-500">{action.detail}</p>
                </div>
                <ChevronRight className="mt-3 h-4 w-4 text-slate-400" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm font-semibold text-blue-600">
            View all recommendations <ChevronRight className="h-4 w-4" />
          </div>
        </Card>
      </div>
    </>
  );
}
