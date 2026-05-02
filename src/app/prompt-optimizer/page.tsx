import { AlertTriangle, ChevronRight, Info, MoreHorizontal, Play, UploadCloud } from "lucide-react";
import { MetricComparisonChart, Sparkline } from "@/components/charts";
import { Badge, Button, Card, PageHeader } from "@/components/primitives";
import { metricComparison, promptCandidates, promptIssues, project } from "@/data/evalops";

const currentPrompt = [
  "You are a helpful support assistant.",
  "Answer the user's question using the knowledge base.",
  "",
  "Be concise and friendly.",
  "If you don't know, say you don't know.",
  "",
  "Format the response in markdown.",
];

const candidateSpark = [55, 58, 56, 61, 59, 64, 62, 66, 65, 69, 67, 71, 73, 70, 76, 75, 78];

export default function PromptOptimizerPage() {
  return (
    <>
      <PageHeader
        title="Prompt Optimizer"
        actions={
          <>
            <Button variant="secondary">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            <Button>
              <Play className="h-4 w-4" />
              Run evaluation
            </Button>
          </>
        }
        meta={
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
            <span>
              Project <strong className="ml-2 text-slate-700">{project.name}</strong>
            </span>
            <span>
              Dataset <strong className="ml-2 text-slate-700">{project.dataset}</strong>
            </span>
            <span>
              Model mix <strong className="ml-2 text-slate-700">{project.modelMix.join("  •  ")}</strong>
            </span>
          </div>
        }
      />

      <div className="mb-5 flex gap-8 border-b border-slate-200">
        {["Overview", "Experiments", "Prompt library", "Evaluation history"].map((tab, index) => (
          <button
            key={tab}
            className={
              index === 0
                ? "border-b-2 border-blue-600 pb-3 text-sm font-semibold text-blue-700"
                : "pb-3 text-sm font-medium text-slate-600"
            }
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[350px_1fr]">
        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950">Current prompt</h2>
            <Button variant="secondary" className="h-8 px-3">View full</Button>
          </div>
          <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-7 text-slate-700">
            {currentPrompt.map((line, index) => (
              <div key={index} className="grid grid-cols-[24px_1fr]">
                <span className="text-slate-400">{index + 1}</span>
                <span>{line || "\u00a0"}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>Prompt ID: prmp_t73b2c1e</span>
            <span>Last used: May 19, 10:24 AM</span>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950">Detected issues</h2>
            <Badge tone="red">3 issues</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {promptIssues.map((issue) => (
              <div key={issue.title} className="grid grid-cols-[20px_1fr_16px] gap-3 rounded-[8px] border border-slate-200 p-3">
                <AlertTriangle className="mt-1 h-4 w-4 text-red-500" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{issue.title}</h3>
                    <Badge tone={issue.impact.startsWith("High") ? "red" : "amber"}>{issue.impact}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{issue.detail}</p>
                </div>
                <ChevronRight className="mt-2 h-4 w-4 text-slate-400" />
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-between text-sm">
            <span className="text-slate-500">+2 minor issues</span>
            <button className="font-semibold text-blue-600">View all issues</button>
          </div>
        </Card>

        <div className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {promptCandidates.map((candidate, index) => (
              <Card
                key={candidate.name}
                className={
                  candidate.name === "Candidate A"
                    ? "p-4 ring-1 ring-blue-500"
                    : candidate.name === "Candidate B"
                      ? "border-emerald-200 bg-emerald-50/30 p-4"
                      : "p-4"
                }
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-950">{candidate.name}</h2>
                  <Badge tone={candidate.name === "Current" ? "blue" : "green"}>{candidate.label}</Badge>
                </div>
                <div className="rounded-[8px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <Badge tone="green">Quality score</Badge>
                  </div>
                  <div className="mt-4 text-4xl font-semibold text-slate-950">
                    {candidate.quality}
                    <span className="text-base font-medium text-slate-500"> /100</span>
                  </div>
                </div>
                <div className="mt-5 space-y-4">
                  {[
                    ["Pass rate", candidate.passRate, "#2563eb"],
                    ["Cost per run", candidate.cost, "#f97316"],
                    ["Latency (p95)", candidate.latency, "#7c3aed"],
                  ].map(([label, value, color]) => (
                    <div key={label} className="grid grid-cols-[1fr_auto_86px] items-center gap-3 text-sm">
                      <span className="text-slate-600">{label}</span>
                      <span className="font-semibold text-slate-950">{value}</span>
                      <Sparkline data={candidateSpark.slice(index, index + 12)} color={color} />
                    </div>
                  ))}
                  <div className="grid grid-cols-[1fr_auto_86px] items-center gap-3 text-sm">
                    <span className="text-slate-600">Regression risk</span>
                    <span
                      className={
                        candidate.risk === "High"
                          ? "font-semibold text-red-600"
                          : candidate.risk === "Medium"
                            ? "font-semibold text-orange-600"
                            : "font-semibold text-emerald-600"
                      }
                    >
                      {candidate.risk}
                    </span>
                    <Sparkline data={candidateSpark.slice(2, 14).reverse()} color={candidate.risk === "Low" ? "#16a34a" : candidate.risk === "Medium" ? "#f97316" : "#ef4444"} />
                  </div>
                </div>
                <Button variant={candidate.name === "Candidate A" ? "primary" : "secondary"} className="mt-5 w-full">
                  View details
                </Button>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_0.7fr]">
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                  Metric comparison <Info className="h-4 w-4 text-slate-400" />
                </h2>
                <Badge>Normalized (higher is better)</Badge>
              </div>
              <MetricComparisonChart data={metricComparison} />
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b border-slate-100 p-4">
                <div className="mb-1 flex items-center gap-2">
                  <Badge tone="red">Failure cluster insight</Badge>
                  <Badge tone="red">High impact</Badge>
                </div>
                <p className="text-sm text-slate-500">Top regression clusters are linked to prompt weaknesses.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  ["Incorrect refund eligibility", "32.1% of regressions", "Ambiguity"],
                  ["Missed escalation for high-frustration users", "20.1% of regressions", "Missing escalation rules"],
                  ["Inconsistent formatting in structured answers", "14.2% of regressions", "Formatting guidelines"],
                ].map(([title, detail, label], index) => (
                  <div key={title} className="grid grid-cols-[24px_1fr_auto] gap-3 p-4 text-sm">
                    <span className="font-semibold text-slate-600">{index + 1}</span>
                    <span>
                      <strong className="block text-slate-900">{title}</strong>
                      <span className="text-xs text-slate-500">{detail}</span>
                    </span>
                    <Badge tone={index === 2 ? "amber" : "violet"}>{label}</Badge>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm font-semibold text-blue-600">
                View all failure clusters <ChevronRight className="h-4 w-4" />
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Card className="mt-5 border-emerald-300 bg-emerald-50 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-white text-emerald-600">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Recommendation</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Promote Candidate B to production</h2>
              <p className="mt-3 text-sm text-slate-500">
                Based on evaluation results from May 12 - May 19, 2025 (1.2k runs)
              </p>
            </div>
          </div>
          <div className="grid gap-2 text-sm text-slate-700">
            <span>+16.7% higher pass rate</span>
            <span>-14% lower regression risk</span>
            <span>Comparable cost & latency</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary">Compare side-by-side</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700">Promote Candidate B</Button>
          </div>
        </div>
      </Card>
    </>
  );
}
