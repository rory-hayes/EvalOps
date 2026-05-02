import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { Badge, Button, Card, PageHeader } from "@/components/primitives";
import { evalCases } from "@/data/evalops";

const selectedCase = evalCases[0];

function sourceLabel(source: string) {
  return source === "known_failure"
    ? "Known failure"
    : source[0].toUpperCase() + source.slice(1);
}

export default function EvalBuilderPage() {
  return (
    <div className="grid gap-0 xl:grid-cols-[1fr_360px] 2xl:grid-cols-[1fr_410px]">
      <section className="min-w-0 xl:pr-5">
        <PageHeader title="Eval Builder" />
        <div className="mb-5 flex gap-8 border-b border-slate-200">
          {["Golden Set", "Regression Set", "Edge Cases", "Safety"].map((tab, index) => (
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
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Button>
            <Plus className="h-4 w-4" />
            Generate more cases
          </Button>
          <Button variant="secondary">Bulk tag</Button>
          <Button variant="secondary">Move to regression</Button>
          <Button variant="secondary">
            <Download className="h-4 w-4" />
            Export eval pack
          </Button>
          <label className="relative ml-auto min-w-56 flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-10 w-full rounded-[7px] border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              placeholder="Search cases..."
            />
          </label>
          <Button variant="secondary">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <span className="block h-4 w-4 rounded border border-slate-200" />
                  </th>
                  <th className="px-4 py-3">Case name</th>
                  <th className="px-4 py-3">Intent</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Grader</th>
                  <th className="px-4 py-3">Last result</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">
                    <Settings className="ml-auto h-4 w-4" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {evalCases.map((item, index) => (
                  <tr
                    key={item.id}
                    className={
                      index === 0
                        ? "bg-blue-50/40 outline outline-1 -outline-offset-1 outline-blue-500"
                        : "bg-white"
                    }
                  >
                    <td className="px-4 py-4">
                      <span
                        className={
                          index === 0
                            ? "flex h-4 w-4 items-center justify-center rounded bg-blue-600 text-white"
                            : "block h-4 w-4 rounded border border-slate-200"
                        }
                      >
                        {index === 0 ? <CheckCircle2 className="h-3 w-3" /> : null}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="font-mono text-xs text-slate-500">#{item.id}</div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={item.intent === "Billing" ? "violet" : item.intent === "Escalation" ? "orange" : "blue"}>
                        {item.intent}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={item.source === "production" ? "green" : item.source === "synthetic" ? "amber" : "blue"}>
                        {sourceLabel(item.source)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={item.risk === "high" ? "red" : item.risk === "medium" ? "amber" : "green"}>
                        {item.risk[0].toUpperCase() + item.risk.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{item.grader}</td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{item.lastResult}%</div>
                      <div className="text-xs text-slate-500">May {19 - index}, 2025</div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={item.status === "passed" ? "green" : "red"}>
                        {item.status === "passed" ? "Passed" : "Failed"}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-right text-slate-500">
                      <MoreVertical className="ml-auto h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 text-xs text-slate-500">
            <span>Showing 1-12 of 124 cases</span>
            <div className="flex items-center gap-2">
              <button className="h-8 w-8 rounded-[7px] border border-slate-200 text-slate-400">
                <ChevronLeft className="mx-auto h-4 w-4" />
              </button>
              {[1, 2, 3].map((page) => (
                <button
                  key={page}
                  className={
                    page === 1
                      ? "h-8 w-8 rounded-[7px] border border-blue-500 text-blue-700"
                      : "h-8 w-8 rounded-[7px] border border-slate-200 text-slate-600"
                  }
                >
                  {page}
                </button>
              ))}
              <span>...</span>
              <button className="h-8 w-8 rounded-[7px] border border-slate-200 text-slate-600">11</button>
              <button className="h-8 w-8 rounded-[7px] border border-slate-200 text-slate-600">
                <ChevronRight className="mx-auto h-4 w-4" />
              </button>
              <button className="h-8 rounded-[7px] border border-slate-200 px-3 text-slate-600">12 / page</button>
            </div>
          </div>
        </Card>
      </section>

      <aside className="mt-6 border-t border-slate-200 bg-white pt-6 xl:mt-0 xl:border-l xl:border-t-0 xl:px-5 xl:pt-0">
        <div className="mb-5 flex items-center justify-between">
          <Badge>GS-1024</Badge>
          <div className="flex gap-2 text-slate-500">
            <button className="h-8 w-8 rounded-[7px] border border-slate-200">
              <ChevronLeft className="mx-auto h-4 w-4" />
            </button>
            <button className="h-8 w-8 rounded-[7px] border border-slate-200">
              <ChevronRight className="mx-auto h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950">{selectedCase.name}</h2>
          <Badge tone="green">Passed</Badge>
        </div>
        <div className="mb-5 flex gap-6 border-b border-slate-200">
          <button className="border-b-2 border-blue-600 pb-3 text-sm font-semibold text-blue-700">
            Details
          </button>
          <button className="pb-3 text-sm font-medium text-slate-600">Grading history</button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {[
            ["Intent", selectedCase.intent, "violet"],
            ["Risk level", "Medium", "amber"],
            ["Source", "Production", "green"],
            ["Grader", selectedCase.grader, "violet"],
          ].map(([label, value, tone]) => (
            <label key={label} className="block">
              <span className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</span>
              <button className="mt-2 flex h-10 w-full items-center justify-between rounded-[7px] border border-slate-200 px-3 text-sm">
                <Badge tone={tone as never}>{value}</Badge>
                <ChevronRight className="h-4 w-4 rotate-90 text-slate-400" />
              </button>
            </label>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">User input</span>
            <textarea
              className="mt-2 min-h-32 w-full rounded-[7px] border border-slate-200 p-3 text-sm leading-6 text-slate-700"
              defaultValue={selectedCase.userInput}
            />
            <span className="text-xs text-slate-400">152 / 1000</span>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Expected behavior</span>
            <textarea
              className="mt-2 min-h-40 w-full rounded-[7px] border border-slate-200 p-3 text-sm leading-6 text-slate-700"
              defaultValue={selectedCase.expectedBehavior}
            />
            <span className="text-xs text-slate-400">221 / 1000</span>
          </label>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Acceptance criteria</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {selectedCase.acceptanceCriteria.map((criterion) => (
                <li key={criterion} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-slate-500" />
                  {criterion}
                </li>
              ))}
            </ul>
            <button className="mt-3 text-sm font-semibold text-blue-600">+ Add criteria</button>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Notes</span>
            <textarea
              className="mt-2 min-h-20 w-full rounded-[7px] border border-slate-200 p-3 text-sm"
              placeholder="Add notes for this case..."
            />
            <span className="text-xs text-slate-400">0 / 500</span>
          </label>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span>
            Created
            <strong className="block pt-1 font-medium text-slate-700">May 10, 2025 by Alex Kim</strong>
          </span>
          <span>
            Last updated
            <strong className="block pt-1 font-medium text-slate-700">May 19, 2025 by Alex Kim</strong>
          </span>
        </div>
        <div className="mt-8 flex items-center justify-between gap-3">
          <Button variant="secondary" className="w-10 px-0">
            <Trash2 className="h-4 w-4" />
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary">Cancel</Button>
            <Button>Save changes</Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
