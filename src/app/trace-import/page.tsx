import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Columns3,
  Filter,
  Info,
  Loader2,
  LockKeyhole,
  MoreVertical,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { Badge, Button, Card, PageHeader, ProgressBar } from "@/components/primitives";
import { importSteps, traceImports } from "@/data/evalops";

const sourceTone = {
  CSV: "green",
  JSON: "blue",
  NDJSON: "violet",
  TXT: "slate",
};

export default function TraceImportPage() {
  return (
    <>
      <PageHeader
        title="Trace Import"
        description="Bring your conversation and model interaction data into EvalOps Copilot for evaluation."
      />

      <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {["Upload files", "Paste samples", "Zendesk", "Intercom", "Langfuse", "LangSmith"].map((tab, index) => (
          <button
            key={tab}
            className={
              index === 0
                ? "flex h-9 items-center gap-2 rounded-[7px] bg-blue-50 px-3 text-sm font-semibold text-blue-700"
                : "flex h-9 items-center gap-2 rounded-[7px] px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
            }
          >
            {index === 0 ? <UploadCloud className="h-4 w-4" /> : null}
            {tab}
            {index > 1 ? <Badge>Coming soon</Badge> : null}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_440px]">
        <div className="space-y-4">
          <Card className="overflow-hidden border-dashed border-blue-200">
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <UploadCloud className="h-6 w-6" />
              </div>
              <h2 className="text-base font-semibold text-slate-950">Drag & drop files here</h2>
              <button className="mt-1 text-sm font-semibold text-blue-600">or click to browse</button>
              <p className="mt-4 text-sm text-slate-500">
                Supports CSV, JSON, conversation logs, and prompt-output pairs.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3 text-xs text-slate-500">
                {["CSV", "JSON", "TXT", "NDJSON"].map((format) => (
                  <span key={format} className="rounded-[6px] border border-slate-200 px-3 py-1">
                    {format}
                  </span>
                ))}
                <span className="py-1">Up to 2 GB per file</span>
              </div>
            </div>
            <div className="border-t border-blue-100 bg-blue-50/40 px-5 py-4 text-sm text-slate-600">
              <Info className="mr-2 inline h-4 w-4 text-blue-600" />
              We automatically detect schema and map fields. You can review and confirm on the next step.
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
              <h2 className="text-base font-semibold text-slate-950">
                Imported Traces <span className="ml-2 text-xs font-medium text-slate-500">1,248 traces</span>
              </h2>
              <div className="flex gap-2">
                <Button variant="secondary">
                  <Filter className="h-4 w-4" />
                  Filter
                </Button>
                <Button variant="secondary">
                  <Columns3 className="h-4 w-4" />
                  Columns
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Intent</th>
                    <th className="px-4 py-3">Risk level</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Redaction status</th>
                    <th className="px-4 py-3">Rows</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {traceImports.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <Badge tone={sourceTone[item.source] as never}>{item.source}</Badge>
                          <span className="font-medium text-slate-700">{item.name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(new Date(item.importedAt))}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.primaryIntent}</td>
                      <td className="px-4 py-3">
                        <Badge tone={item.riskLevel === "high" ? "red" : item.riskLevel === "medium" ? "amber" : "green"}>
                          {item.riskLevel[0].toUpperCase() + item.riskLevel.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={item.status === "completed" ? "green" : "blue"}>
                          {item.status === "processing" ? "Processing" : "Completed"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={item.redactionStatus === "redacted" ? "green" : "blue"}>
                          {item.redactionStatus === "redacted" ? "Redacted" : "In progress"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{item.rows.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500">
                        <MoreVertical className="h-4 w-4" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 p-4 text-xs text-slate-500">
              Showing 1 to 5 of 24 imports
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((page) => (
                  <button
                    key={page}
                    className={
                      page === 1
                        ? "h-8 w-8 rounded-[7px] bg-blue-50 font-semibold text-blue-700"
                        : "h-8 w-8 rounded-[7px] border border-slate-200 font-semibold text-slate-500"
                    }
                  >
                    {page}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="grid gap-6 p-5 md:grid-cols-2">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Supported formats</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>
                  <strong className="text-slate-800">CSV:</strong> conversation_id, timestamp, role, content, metadata...
                </p>
                <p>
                  <strong className="text-slate-800">JSON / NDJSON:</strong> messages[], prompt, output, metadata...
                </p>
                <p>
                  <strong className="text-slate-800">Conversation logs:</strong> threads, tickets, chats from support tools
                </p>
                <p>
                  <strong className="text-slate-800">Prompt-output pairs:</strong> prompt, output, model, metadata...
                </p>
              </div>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-950">Schema mapping</h2>
              <p className="mt-2 text-sm text-slate-500">We auto-detect fields and map to EvalOps schema.</p>
              <div className="mt-4 space-y-3 text-sm">
                {["conversation_id -> conversationId", "timestamp -> timestamp", "role -> role", "content -> message.content"].map((row) => (
                  <div key={row} className="flex items-center gap-3 text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {row}
                  </div>
                ))}
              </div>
              <button className="mt-5 flex items-center gap-2 text-sm font-semibold text-blue-600">
                Review & edit mapping <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-950">Import Progress</h2>
              <button className="text-sm font-semibold text-blue-600">View all imports</button>
            </div>
            <div className="text-sm font-semibold text-slate-800">support_logs_may19.csv</div>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-3 text-sm">
              <ProgressBar value={68} />
              <span className="font-semibold text-slate-700">68%</span>
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>Processing 12,458 / 18,347 rows</span>
              <span>2.4 MB / 3.5 MB</span>
            </div>
            <div className="mt-5 space-y-3">
              {importSteps.map((step) => (
                <div key={step.label} className="grid grid-cols-[18px_1fr_auto] items-center gap-2 text-sm">
                  {step.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : step.status === "active" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-300" />
                  )}
                  <span className="text-slate-700">{step.label}</span>
                  <span className="text-xs text-slate-500">{step.timestamp}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-sm text-slate-500">Estimated time remaining: 1m 24s</span>
              <Button variant="secondary">Cancel import</Button>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <LockKeyhole className="h-4 w-4" />
                Privacy & data controls
              </h2>
              <button className="text-sm font-semibold text-blue-600">Learn more</button>
            </div>
            <div className="space-y-4">
              {[
                ["Redact PII", "Detect and redact PII before storage.", true],
                ["Store derived evals only", "Do not store raw inputs/outputs after evaluation.", false],
                ["Delete raw traces after 30 days", "Automatically delete new raw traces after retention period.", true],
                ["Use store:false on model calls", "Send store:false to providers that support it.", true],
              ].map(([title, detail, enabled]) => (
                <div key={String(title)} className="flex items-center justify-between gap-4">
                  <div className="text-sm">
                    <div className="font-semibold text-slate-800">{title}</div>
                    <div className="text-xs text-slate-500">{detail}</div>
                  </div>
                  <span
                    className={
                      enabled
                        ? "relative h-6 w-11 rounded-full bg-blue-600"
                        : "relative h-6 w-11 rounded-full bg-slate-200"
                    }
                  >
                    <span
                      className={
                        enabled
                          ? "absolute right-1 top-1 h-4 w-4 rounded-full bg-white"
                          : "absolute left-1 top-1 h-4 w-4 rounded-full bg-white"
                      }
                    />
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
              <span className="font-semibold text-slate-700">Data residency</span>
              <Badge>US (N. Virginia)</Badge>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Your data is encrypted in transit and at rest.
            </p>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 p-4">
              <h2 className="text-base font-semibold text-slate-950">Preview: Redacted Trace</h2>
            </div>
            <pre className="max-h-72 overflow-auto bg-slate-50 p-4 font-mono text-xs leading-5 text-slate-700">
{`{
  "conversation_id": "c_9f8b2e7a",
  "timestamp": "2025-05-19T10:23:41Z",
  "messages": [
    {
      "role": "user",
      "content": "I was charged twice on my card ****1234",
      "metadata": { "pii_redacted": ["card_number", "email"] }
    },
    {
      "role": "assistant",
      "content": "I can help with that. Can you confirm ...",
      "metadata": { "pii_redacted": [] }
    }
  ]
}`}
            </pre>
            <div className="border-t border-slate-100 p-3 text-xs text-slate-500">
              <Info className="mr-1 inline h-4 w-4 text-blue-600" />
              PII has been detected and redacted. Hover over values for details.
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
