import { CheckCircle2, ChevronRight, Import, MoreVertical, Plus, Search, ToggleRight } from "lucide-react";
import { CalibrationHeatmap, ScoreScatter } from "@/components/charts";
import { Badge, Button, Card, IconTile, PageHeader } from "@/components/primitives";
import { calibrationMatrix, graders } from "@/data/evalops";

const selected = graders.find((grader) => grader.id === "grader_tone") ?? graders[0];

export default function GradersPage() {
  return (
    <>
      <PageHeader
        title="Graders"
        description="Configure, calibrate, and manage graders used across evaluations."
        actions={
          <>
            <Button variant="secondary">Calibrate all</Button>
            <Button variant="secondary">
              <Import className="h-4 w-4" />
              Import grader
            </Button>
            <Button>
              <Plus className="h-4 w-4" />
              New grader
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["Total graders", "12", "+2 this week", "blue"],
          ["Avg. agreement", "0.84", "+0.05 vs last 7 days", "green"],
          ["High agreement (> 0.75)", "9", "75% of graders", "green"],
          ["Low agreement (< 0.60)", "1", "Needs attention", "red"],
          ["Calibrated this week", "4", "+2 vs last week", "green"],
        ].map(([label, value, detail, tone]) => (
          <Card key={label} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-600">{label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
                <p className={tone === "red" ? "mt-2 text-sm text-red-600" : "mt-2 text-sm text-emerald-600"}>
                  {detail}
                </p>
              </div>
              <IconTile icon={CheckCircle2} tone={tone as never} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[390px_1fr]">
        <Card className="p-4">
          <h2 className="text-base font-semibold text-slate-950">Grader types (12)</h2>
          <div className="mt-4 flex gap-2">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="h-10 w-full rounded-[7px] border border-slate-200 pl-9 pr-3 text-sm" placeholder="Search graders..." />
            </label>
            <button className="h-10 rounded-[7px] border border-slate-200 px-3 text-sm font-semibold text-slate-600">
              All status
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {graders.map((grader) => (
              <button
                key={grader.id}
                className={
                  grader.id === selected.id
                    ? "grid w-full grid-cols-[42px_1fr_auto_auto] items-center gap-3 rounded-[8px] border border-red-300 bg-red-50 p-3 text-left"
                    : "grid w-full grid-cols-[42px_1fr_auto_auto] items-center gap-3 rounded-[8px] border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
                }
              >
                <IconTile icon={grader.health === "low_agreement" ? ToggleRight : CheckCircle2} tone={grader.health === "low_agreement" ? "red" : "blue"} />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{grader.name}</span>
                  <span className="block text-xs leading-4 text-slate-500">{grader.description}</span>
                </span>
                <Badge tone={grader.health === "low_agreement" ? "red" : "green"}>
                  {grader.health === "low_agreement" ? "Low agreement" : "Healthy"}
                </Badge>
                <span className={grader.health === "low_agreement" ? "font-semibold text-red-600" : "font-semibold text-slate-700"}>
                  {grader.agreement.toFixed(2)}
                </span>
              </button>
            ))}
          </div>
          <button className="mx-auto mt-5 flex items-center gap-1 text-sm font-semibold text-blue-600">
            Show 6 more graders <ChevronRight className="h-4 w-4 rotate-90" />
          </button>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-slate-950">{selected.name}</h2>
                <Badge tone="red">Low agreement</Badge>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                Active
                <span className="relative h-6 w-11 rounded-full bg-blue-600">
                  <span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white" />
                </span>
                <button className="h-9 w-9 rounded-[7px] border border-slate-200">
                  <MoreVertical className="mx-auto h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-5 flex gap-7 border-b border-slate-200">
              {["Configuration", "Scoring rubric", "Calibration", "Runs"].map((tab, index) => (
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
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr_1.2fr]">
            <Card className="p-4 shadow-none">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Configuration</h3>
                <Button variant="secondary" className="h-8 px-3">Edit</Button>
              </div>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Type</dt>
                  <dd className="font-medium text-slate-800">LLM Judge</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Model</dt>
                  <dd className="font-medium text-slate-800">{selected.model}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Prompt template</dt>
                  <dd className="font-medium text-slate-800">tone_judge_v2</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Input</dt>
                  <dd className="font-medium text-slate-800">Response, Instruction, Conversation context</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Output</dt>
                  <dd className="font-medium text-slate-800">Score (0-1) + Explanation</dd>
                </div>
              </dl>
            </Card>

            <Card className="p-4 shadow-none">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Thresholds</h3>
                <Button variant="secondary" className="h-8 px-3">Edit</Button>
              </div>
              <div className="space-y-5 text-sm">
                {[
                  ["Pass threshold", "0.70", "Pass", "Score >= 0.70", "green"],
                  ["Review threshold", "0.40", "Review", "0.40 <= Score < 0.70", "amber"],
                  ["Fail threshold", "0.40", "Fail", "Score < 0.40", "red"],
                ].map(([label, value, badge, detail, tone]) => (
                  <div key={label}>
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="text-xl font-semibold text-slate-950">{value}</span>
                      <Badge tone={tone as never}>{badge}</Badge>
                      <span className="text-xs text-slate-500">{detail}</span>
                    </div>
                  </div>
                ))}
                <div>
                  <div className="text-xs text-slate-500">Aggregation</div>
                  <div className="mt-1 font-medium text-slate-800">Mean score</div>
                </div>
              </div>
            </Card>

            <div className="rounded-[8px] border border-red-200 bg-red-50 p-4">
              <h3 className="flex items-center gap-2 font-semibold text-red-700">
                <ToggleRight className="h-5 w-5" />
                Low agreement detected
              </h3>
              <p className="mt-4 text-sm leading-6 text-slate-700">
                Agreement is 0.42, below the recommended threshold of 0.60.
              </p>
              <h4 className="mt-4 text-sm font-semibold text-red-700">Impact</h4>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                <li>Higher risk of inconsistent scoring</li>
                <li>May affect evaluation reliability</li>
              </ul>
              <div className="mt-5 rounded-[8px] border border-orange-200 bg-orange-50 p-4">
                <h4 className="font-semibold text-orange-700">Recommendation</h4>
                <p className="mt-2 text-sm text-slate-700">Recalibrate this grader with a new calibration set.</p>
                <Button variant="secondary" className="mt-4 border-orange-300 text-orange-700">
                  Recalibrate grader
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 p-5">
            <h3 className="mb-4 text-base font-semibold text-slate-950">
              Agreement (Human score vs LLM judge score)
            </h3>
            <div className="grid gap-4 lg:grid-cols-[130px_1fr_1fr]">
              <div className="rounded-[8px] bg-red-50 p-4">
                <div className="text-3xl font-semibold text-red-600">0.42</div>
                <div className="mt-1 text-sm font-medium text-slate-700">Cohen&apos;s Kappa</div>
                <Badge tone="red" className="mt-3">Low agreement</Badge>
                <div className="mt-5 space-y-3 text-xs text-slate-600">
                  <p>
                    <strong className="block text-slate-900">95% CI</strong>
                    0.28 - 0.56
                  </p>
                  <p>
                    <strong className="block text-slate-900">Samples</strong>
                    312
                  </p>
                  <p>
                    <strong className="block text-slate-900">Last calibrated</strong>
                    May 17, 2025
                  </p>
                </div>
              </div>
              <CalibrationHeatmap values={calibrationMatrix} />
              <ScoreScatter />
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Kappa &lt; 0.60 indicates low to moderate agreement. Consider reviewing rubric, examples, and threshold settings.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
