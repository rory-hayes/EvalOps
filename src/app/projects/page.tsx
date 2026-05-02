import { CheckCircle2, ChevronRight } from "lucide-react";
import { Badge, Button, Card, IconTile, PageHeader } from "@/components/primitives";
import { generatedAssets, workflowOptions } from "@/data/evalops";

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Create New Project"
        description="Set up your evaluation audit in a few simple steps."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {["Workflow", "Data Sources", "Success Criteria", "Privacy", "Review"].map((step, index) => (
          <div key={step} className="flex items-center gap-3">
            <span
              className={
                index === 0
                  ? "flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white"
                  : "flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-500"
              }
            >
              {index + 1}
            </span>
            <span className={index === 0 ? "text-sm font-semibold text-blue-700" : "text-sm text-slate-500"}>
              {step}
            </span>
            {index < 4 ? <span className="hidden h-px w-20 bg-slate-200 md:block" /> : null}
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="p-5 lg:p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-950">1. Choose your evaluation workflow</h2>
            <p className="mt-3 text-sm text-slate-600">
              Select the workflow that best matches what you want to evaluate.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workflowOptions.map((option) => (
              <button
                key={option.title}
                className={
                  option.recommended
                    ? "relative rounded-[8px] border border-blue-600 bg-blue-50/40 p-4 text-left shadow-[0_0_0_1px_rgba(37,99,235,0.2)]"
                    : "relative rounded-[8px] border border-slate-200 bg-white p-4 text-left hover:border-blue-200 hover:bg-blue-50/20"
                }
              >
                <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white">
                  {option.recommended ? <span className="h-3 w-3 rounded-full bg-blue-600" /> : null}
                </span>
                <IconTile icon={option.icon} tone={option.recommended ? "blue" : "violet"} className="mb-9 h-12 w-12" />
                <h3 className="min-h-10 text-base font-semibold leading-5 text-slate-950">{option.title}</h3>
                <p className="mt-3 text-xs leading-5 text-slate-600">{option.description}</p>
                {option.recommended ? (
                  <Badge tone="blue" className="mt-7">
                    <CheckCircle2 className="h-3 w-3" />
                    Recommended
                  </Badge>
                ) : null}
              </button>
            ))}
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-slate-950">2. Project details</h2>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Project name</span>
                <input
                  className="mt-2 h-11 w-full rounded-[7px] border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  defaultValue="Support Assistant - Q2 Audit"
                />
                <span className="mt-2 block text-xs text-slate-500">A friendly name to identify this project.</span>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Project owner</span>
                <button className="mt-2 flex h-11 w-full items-center justify-between rounded-[7px] border border-slate-200 px-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-white">
                      AM
                    </span>
                    Alex Morgan
                  </span>
                  <ChevronRight className="h-4 w-4 rotate-90 text-slate-500" />
                </button>
                <span className="mt-2 block text-xs text-slate-500">Owner will be notified of key updates.</span>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Environment</span>
                <button className="mt-2 flex h-11 w-full items-center justify-between rounded-[7px] border border-slate-200 px-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Production
                  </span>
                  <ChevronRight className="h-4 w-4 rotate-90 text-slate-500" />
                </button>
                <span className="mt-2 block text-xs text-slate-500">Select the environment being evaluated.</span>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Evaluation objective</span>
                <textarea
                  className="mt-2 min-h-28 w-full rounded-[7px] border border-slate-200 p-3 text-sm leading-6 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  defaultValue="Measure end-to-end quality of the Support Assistant across intent coverage, response quality, safety, and escalation accuracy."
                />
                <span className="mt-2 block text-xs text-slate-500">What are you trying to learn or improve?</span>
              </label>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <Button>
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-950">What will be generated</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Based on your selections, we will generate the following assets for your audit.
          </p>
          <div className="mt-7 space-y-6">
            {generatedAssets.map((asset) => (
              <div key={asset.title} className="grid grid-cols-[48px_1fr] gap-4">
                <IconTile icon={asset.icon} tone={asset.color as never} className="h-12 w-12" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{asset.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{asset.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-[8px] bg-blue-50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-700">
              <CheckCircle2 className="h-4 w-4" />
              You are in control
            </h3>
            <p className="mt-2 text-xs leading-5 text-blue-700/80">
              You can review and customize every asset before running your evaluation.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
