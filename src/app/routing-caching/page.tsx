import { ChevronRight, Download, Info, Settings } from "lucide-react";
import { CacheTrendChart, TinyComparisonBars } from "@/components/charts";
import { Badge, Button, Card, IconTile, PageHeader, ProgressBar } from "@/components/primitives";
import { cacheRecommendations, cacheTrend, project, routingRules } from "@/data/evalops";

export default function RoutingCachingPage() {
  return (
    <>
      <PageHeader
        title="Routing & Caching"
        actions={
          <>
            <Button variant="secondary">
              <Download className="h-4 w-4" />
              Export report
            </Button>
            <Button variant="secondary">
              <Settings className="h-4 w-4" />
              Routing settings
            </Button>
          </>
        }
        meta={
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
            <span>
              Project <strong className="ml-2 text-slate-700">{project.name}</strong>
            </span>
            <span>
              Last run <strong className="ml-2 text-slate-700">{project.lastRun}</strong>
            </span>
            <span>
              Prompt version <strong className="ml-2 text-slate-700">{project.promptVersion}</strong>
            </span>
            <span>
              Model mix <strong className="ml-2 text-slate-700">{project.modelMix.join("  •  ")}</strong>
            </span>
          </div>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Intent to Model Routing</h2>
            <p className="mt-2 text-sm text-slate-500">
              Define how each intent is routed to the best model with intelligent fallbacks.
            </p>
          </div>
          <Button variant="secondary">Edit routing</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">Intent</th>
                <th className="px-4 py-3">Assigned Model</th>
                <th className="px-4 py-3">Fallback Route</th>
                <th className="px-4 py-3">Quality Score</th>
                <th className="px-4 py-3">Est. Cost / 1K</th>
                <th className="px-4 py-3">Est. Latency</th>
                <th className="px-4 py-3">Traffic Share</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {routingRules.map((rule) => (
                <tr key={rule.intent}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3 font-semibold text-slate-800">
                      <IconTile icon={rule.icon} tone={rule.intent === "High Risk" ? "red" : rule.intent === "Billing" ? "green" : "blue"} />
                      {rule.intent}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{rule.model}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={rule.fallback.includes("Human") ? "violet" : "slate"}>{rule.fallback}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 font-semibold text-slate-900">{rule.quality}</span>
                      <ProgressBar value={rule.quality} tone="green" className="w-24" />
                    </div>
                  </td>
                  <td className={rule.cost > "$0.026" ? "px-4 py-3 font-semibold text-red-500" : "px-4 py-3 font-semibold text-emerald-600"}>
                    {rule.cost}
                  </td>
                  <td className={rule.latency > "2.0s" ? "px-4 py-3 font-semibold text-orange-600" : "px-4 py-3 font-semibold text-emerald-600"}>
                    {rule.latency}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-9 font-semibold text-slate-700">{rule.traffic}</span>
                      <TinyComparisonBars value={Number.parseInt(rule.traffic, 10) * 3} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 p-4 text-xs text-slate-500">
          Quality Score is based on historical eval performance, user feedback, and outcome success.
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card className="p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
            Prompt Caching Analysis <Info className="h-4 w-4 text-slate-400" />
          </h2>
          <p className="mt-2 text-sm text-slate-500">Analysis of cacheable content across your prompts.</p>
          <div className="mt-5 grid gap-4 border-b border-slate-100 pb-4 sm:grid-cols-4">
            {[
              ["Cacheable Prefix", "72.6%", "+8.4pp vs last run"],
              ["Repeated Blocks", "14", "+2 vs last run"],
              ["Est. Cost Savings", "$1,842 /mo", "+22% vs last run"],
              ["Est. Latency Savings", "412ms", "+18% vs last run"],
            ].map(([label, value, detail]) => (
              <div key={label} className="border-r border-slate-100 last:border-r-0">
                <div className="text-sm font-semibold text-slate-600">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
                <div className="mt-1 text-xs text-emerald-600">{detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_250px]">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Cacheable Prefix Over Time</h3>
              <CacheTrendChart data={cacheTrend} />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Top Repeated Blocks</h3>
              <div className="space-y-3">
                {[
                  ["System instructions", 82],
                  ["Policy & guidelines", 67],
                  ["Tool definitions", 55],
                  ["Output format spec", 48],
                  ["Safety & guardrails", 44],
                ].map(([label, value], index) => (
                  <div key={String(label)} className="grid grid-cols-[24px_1fr_48px] items-center gap-2 text-sm">
                    <Badge>{index + 1}</Badge>
                    <span className="text-slate-700">{label}</span>
                    <ProgressBar value={Number(value)} className="h-1.5" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
              Caching Recommendations <Info className="h-4 w-4 text-slate-400" />
            </h2>
            <p className="mt-2 text-sm text-slate-500">Actionable ways to improve cache hit rate and reduce costs.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {cacheRecommendations.map((item) => (
              <div key={item.title} className="grid grid-cols-[42px_1fr_auto_16px] items-center gap-3 p-4">
                <IconTile icon={item.icon} tone={item.impact.startsWith("High") ? "green" : item.impact.startsWith("Medium") ? "orange" : "blue"} />
                <span>
                  <strong className="block text-sm text-slate-900">{item.title}</strong>
                  <span className="text-xs leading-5 text-slate-500">{item.detail}</span>
                </span>
                <Badge tone={item.impact.startsWith("High") ? "green" : item.impact.startsWith("Medium") ? "amber" : "slate"}>
                  {item.impact}
                </Badge>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm font-semibold text-blue-600">
            View all recommendations <ChevronRight className="h-4 w-4" />
          </div>
        </Card>
      </div>

      <Card className="mt-4 p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
          Savings Simulator <Info className="h-4 w-4 text-slate-400" />
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Estimate potential monthly savings based on traffic and optimization improvements.
        </p>
        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_520px]">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["Monthly conversations", "100,000"],
              ["Cache hit rate", "42%"],
              ["Avg. prompt tokens", "1,240"],
              ["Model mix", "Current"],
            ].map(([label, value]) => (
              <label key={label}>
                <span className="text-sm font-semibold text-slate-600">{label}</span>
                <input
                  className="mt-2 h-11 w-full rounded-[7px] border border-slate-200 px-3 text-sm font-semibold text-slate-800"
                  defaultValue={value}
                />
              </label>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_24px_1fr_1fr] items-stretch gap-4">
            <div className="rounded-[8px] border border-slate-200 p-4 text-center">
              <p className="text-xs text-slate-500">Est. Monthly Cost</p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">$7,268</p>
              <p className="text-sm text-slate-500">Current</p>
            </div>
            <span className="flex items-center justify-center text-slate-400">→</span>
            <div className="rounded-[8px] border border-slate-200 p-4 text-center">
              <p className="text-xs text-slate-500">Est. Monthly Cost</p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">$5,426</p>
              <p className="text-sm text-emerald-600">With optimizations</p>
            </div>
            <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-xs text-slate-500">Est. Monthly Savings</p>
              <p className="mt-3 text-2xl font-semibold text-emerald-600">$1,842</p>
              <p className="text-sm text-emerald-600">25.3% reduction</p>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
