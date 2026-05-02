"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, PageHeader, ProgressBar } from "@/components/primitives";
import type { WorkspaceState } from "@/lib/server/types";

type View =
  | "dashboard"
  | "projects"
  | "trace-import"
  | "eval-builder"
  | "graders"
  | "prompt-optimizer"
  | "routing-caching"
  | "reports"
  | "settings";

type ApiEnvelope<T> =
  | { ok: true; data: T; correlationId: string }
  | { ok: false; error: { code: string; message: string; correlationId: string } };

export function WorkspaceApp({ view }: { view: View }) {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh(projectId?: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/app-state${projectId ? `?projectId=${projectId}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<WorkspaceState>;
      if (!payload.ok) throw new Error(payload.error.message);
      setState(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load workspace.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh();
    }, 0);
    const listener = () => refresh();
    window.addEventListener("evalops:refresh", listener);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("evalops:refresh", listener);
    };
  }, []);

  async function mutate<T>(label: string, action: () => Promise<T>, projectId?: string) {
    setBusy(label);
    setError(null);
    try {
      await action();
      await refresh(projectId || state?.activeProject?.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  if (loading && !state) {
    return (
      <Card className="p-8">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading persisted workspace state...
        </div>
      </Card>
    );
  }

  if (error && !state) {
    return (
      <Card className="p-8">
        <h1 className="text-xl font-semibold text-slate-950">Workspace unavailable</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{error}</p>
        <Button className="mt-5" onClick={() => refresh()}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </Card>
    );
  }

  if (!state) return null;

  const needsProject = !state.activeProject && view !== "projects" && view !== "settings";

  return (
    <>
      {error ? (
        <div className="mb-4 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {needsProject ? (
        <ProjectsView state={state} busy={busy} mutate={mutate} />
      ) : view === "dashboard" ? (
        <DashboardView state={state} busy={busy} mutate={mutate} />
      ) : view === "projects" ? (
        <ProjectsView state={state} busy={busy} mutate={mutate} />
      ) : view === "trace-import" ? (
        <TraceImportView state={state} busy={busy} mutate={mutate} />
      ) : view === "eval-builder" ? (
        <EvalBuilderView state={state} busy={busy} mutate={mutate} />
      ) : view === "graders" ? (
        <GradersView state={state} />
      ) : view === "prompt-optimizer" ? (
        <PromptOptimizerView state={state} busy={busy} mutate={mutate} />
      ) : view === "routing-caching" ? (
        <RoutingCachingView state={state} busy={busy} mutate={mutate} />
      ) : view === "reports" ? (
        <ReportsView state={state} busy={busy} mutate={mutate} />
      ) : (
        <SettingsView state={state} />
      )}
    </>
  );
}

function DashboardView({
  state,
  busy,
  mutate,
}: {
  state: WorkspaceState;
  busy: string | null;
  mutate: <T>(label: string, action: () => Promise<T>, projectId?: string) => Promise<void>;
}) {
  const summary = useSummary(state);
  return (
    <>
      <PageHeader
        title="Eval Health Overview"
        description="Live summary from persisted trace imports, eval cases, review issues, exports, and audit events."
        actions={
          state.activeProject ? (
            <Button
              variant="secondary"
              disabled={busy === "rerun"}
              onClick={() =>
                mutate("rerun", () => api(`/api/projects/${state.activeProject?.id}/runs`, { method: "POST" }))
              }
            >
              <Play className="h-4 w-4" />
              Run evaluation
            </Button>
          ) : null
        }
        meta={<ProjectMeta state={state} />}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["Trace imports", state.traceImports.length, "Durable import records", "blue"],
          ["Eval cases", state.evalCases.length, "Generated from persisted traces", "green"],
          ["Open issues", summary.openIssues, "Reviewer action required", summary.openIssues ? "red" : "green"],
          ["Pass rate", `${summary.passRate}%`, "Latest persisted run", "blue"],
          ["Audit events", state.auditEvents.length, "Traceable actions", "slate"],
        ].map(([label, value, detail, tone]) => (
          <MetricCard key={String(label)} label={String(label)} value={String(value)} detail={String(detail)} tone={String(tone)} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Coverage by Intent</h2>
          <div className="mt-5 space-y-4">
            {summary.intentCoverage.length ? (
              summary.intentCoverage.map((item) => (
                <div key={item.intent} className="grid grid-cols-[140px_1fr_56px] items-center gap-3 text-sm">
                  <span className="truncate font-medium text-slate-700">{item.intent}</span>
                  <ProgressBar value={item.percent} tone={item.percent >= 70 ? "green" : "amber"} />
                  <span className="text-right font-semibold text-slate-900">{item.percent}%</span>
                </div>
              ))
            ) : (
              <EmptyText text="Upload traces to create intent coverage." />
            )}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-lg font-semibold text-slate-950">Recent Activity</h2>
          </div>
          <ActivityList state={state} />
        </Card>
      </div>
    </>
  );
}

function ProjectsView({
  state,
  busy,
  mutate,
}: {
  state: WorkspaceState;
  busy: string | null;
  mutate: <T>(label: string, action: () => Promise<T>, projectId?: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: "Support Assistant Audit",
    workflowType: "support_assistant",
    objective: "Measure end-to-end answer quality, escalation accuracy, and billing/refund reliability.",
    riskPreferences: "Billing, Escalation, Privacy",
    privacyMode: "redact_pii",
  });

  return (
    <>
      <PageHeader
        title="Projects"
        description="Create a tenant-scoped project. Creation writes organization, membership, project, optimization seed, and audit records."
        meta={<ProjectMeta state={state} />}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Create New Project</h2>
          <form
            className="mt-5 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              mutate("create-project", async () => {
                const created = await api<{ id: string }>("/api/projects", {
                  method: "POST",
                  body: JSON.stringify({
                    ...form,
                    riskPreferences: form.riskPreferences.split(",").map((item) => item.trim()).filter(Boolean),
                  }),
                });
                return created;
              });
            }}
          >
            <Field label="Project name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Workflow type</span>
              <select
                className="mt-2 h-11 w-full rounded-[7px] border border-slate-200 px-3 text-sm"
                value={form.workflowType}
                onChange={(event) => setForm({ ...form, workflowType: event.target.value })}
              >
                <option value="support_assistant">Support Assistant</option>
                <option value="rag">RAG Knowledge Assistant</option>
                <option value="tool_agent">Tool-Using Agent</option>
                <option value="document_extraction">Document Extraction</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Evaluation objective</span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-[7px] border border-slate-200 p-3 text-sm leading-6"
                value={form.objective}
                onChange={(event) => setForm({ ...form, objective: event.target.value })}
              />
            </label>
            <Field label="Primary risks" value={form.riskPreferences} onChange={(riskPreferences) => setForm({ ...form, riskPreferences })} />
            <Button type="submit" disabled={busy === "create-project"}>
              <Plus className="h-4 w-4" />
              {busy === "create-project" ? "Creating..." : "Create project"}
            </Button>
          </form>
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-lg font-semibold text-slate-950">Existing Projects</h2>
          </div>
          {state.projects.length ? (
            <div className="divide-y divide-slate-100">
              {state.projects.map((project) => (
                <div key={project.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-950">{project.name}</h3>
                    <Badge tone={project.id === state.activeProject?.id ? "blue" : "slate"}>
                      {project.id === state.activeProject?.id ? "Selected" : project.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{project.objective}</p>
                  <p className="mt-3 text-xs text-slate-500">Created {formatDate(project.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4"><EmptyText text="No projects yet. Create one to start importing traces." /></div>
          )}
        </Card>
      </div>
    </>
  );
}

function TraceImportView({
  state,
  busy,
  mutate,
}: {
  state: WorkspaceState;
  busy: string | null;
  mutate: <T>(label: string, action: () => Promise<T>, projectId?: string) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const project = state.activeProject;
  return (
    <>
      <PageHeader
        title="Trace Import"
        description="Upload CSV, JSON, NDJSON, or TXT traces. Files are stored, parsed, redacted, processed, and audited by the backend."
        meta={<ProjectMeta state={state} />}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card className="p-6">
          <input ref={fileRef} type="file" accept=".csv,.json,.ndjson,.txt" className="sr-only" />
          <div className="rounded-[8px] border border-dashed border-blue-200 bg-blue-50/30 p-8 text-center">
            <UploadCloud className="mx-auto h-10 w-10 text-blue-600" />
            <h2 className="mt-4 text-lg font-semibold text-slate-950">Upload trace file</h2>
            <p className="mt-2 text-sm text-slate-600">Browser upload posts to the backend, then Supabase Storage or the test store persists the file.</p>
            <Button
              className="mt-5"
              disabled={!project || busy === "upload"}
              onClick={() =>
                mutate("upload", async () => {
                  const file = fileRef.current?.files?.[0];
                  if (!file) throw new Error("Choose a file before uploading.");
                  const form = new FormData();
                  form.append("file", file);
                  return api(`/api/projects/${project?.id}/imports`, { method: "POST", body: form });
                })
              }
            >
              {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {busy === "upload" ? "Processing..." : "Upload and process"}
            </Button>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                <tr><th className="py-3">File</th><th>Status</th><th>Rows</th><th>Intent</th><th>Risk</th><th>Imported</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.traceImports.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 font-medium text-slate-800">{item.name}</td>
                    <td><Badge tone={item.status === "completed" ? "green" : item.status === "failed" ? "red" : "blue"}>{item.status}</Badge></td>
                    <td>{item.rows}</td>
                    <td>{item.primaryIntent}</td>
                    <td><Badge tone={item.riskLevel === "high" ? "red" : item.riskLevel === "medium" ? "amber" : "green"}>{item.riskLevel}</Badge></td>
                    <td>{formatDate(item.importedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!state.traceImports.length ? <EmptyText text="No imports yet." /> : null}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Processing Jobs</h2>
          <div className="mt-4 space-y-3">
            {state.processingJobs.map((job) => (
              <div key={job.id} className="rounded-[8px] border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-500">{job.id}</span>
                  <Badge tone={job.status === "completed" ? "green" : job.status === "failed" ? "red" : "blue"}>{job.status}</Badge>
                </div>
                {job.errorMessage ? <p className="mt-2 text-red-600">{job.errorMessage}</p> : null}
              </div>
            ))}
            {!state.processingJobs.length ? <EmptyText text="Jobs appear here after upload." /> : null}
          </div>
        </Card>
      </div>
    </>
  );
}

function EvalBuilderView({
  state,
  busy,
  mutate,
}: {
  state: WorkspaceState;
  busy: string | null;
  mutate: <T>(label: string, action: () => Promise<T>, projectId?: string) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(state.evalCases[0]?.id || null);
  const selected = state.evalCases.find((item) => item.id === selectedId) || state.evalCases[0];
  const [comment, setComment] = useState("Reviewed and accepted remediation.");

  return (
    <>
      <PageHeader
        title="Eval Builder"
        description="Generated eval cases are persisted from imported traces and can be reviewed, updated, and exported."
        actions={<ExportButton state={state} busy={busy} mutate={mutate} />}
        meta={<ProjectMeta state={state} />}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card className="overflow-hidden">
          <TableHeader title={`Eval Cases (${state.evalCases.length})`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                <tr><th className="px-4 py-3">Case</th><th>Intent</th><th>Set</th><th>Risk</th><th>Status</th><th>Result</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.evalCases.map((item) => (
                  <tr key={item.id} className={item.id === selected?.id ? "bg-blue-50/50" : ""} onClick={() => setSelectedId(item.id)}>
                    <td className="px-4 py-3"><button className="text-left font-semibold text-blue-700">{item.name}</button></td>
                    <td>{item.intent}</td><td>{item.set}</td>
                    <td><Badge tone={item.risk === "high" ? "red" : item.risk === "medium" ? "amber" : "green"}>{item.risk}</Badge></td>
                    <td><Badge tone={item.status === "passed" ? "green" : item.status === "failed" ? "red" : "amber"}>{item.status}</Badge></td>
                    <td>{item.lastResult}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!state.evalCases.length ? <EmptyText text="Upload traces to generate eval cases." /> : null}
          </div>
        </Card>
        <Card className="p-5">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-950">{selected.name}</h2>
                <Badge tone={selected.status === "passed" ? "green" : selected.status === "failed" ? "red" : "amber"}>{selected.status}</Badge>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-700">User input</p>
              <p className="mt-2 rounded-[8px] bg-slate-50 p-3 text-sm leading-6 text-slate-700">{selected.userInput}</p>
              <p className="mt-4 text-sm font-semibold text-slate-700">Expected behavior</p>
              <p className="mt-2 rounded-[8px] bg-slate-50 p-3 text-sm leading-6 text-slate-700">{selected.expectedBehavior}</p>
              <div className="mt-4 space-y-2">
                {selected.acceptanceCriteria.map((criterion) => (
                  <div key={criterion} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {criterion}
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="font-semibold text-slate-900">Issues</h3>
                {state.issues.filter((issue) => issue.evalCaseId === selected.id).map((issue) => (
                  <div key={issue.id} className="mt-3 rounded-[8px] border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-900">{issue.title}</span>
                      <Badge tone={issue.status === "open" || issue.status === "reopened" ? "red" : "green"}>{issue.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{issue.description}</p>
                    <textarea className="mt-3 min-h-20 w-full rounded-[7px] border border-slate-200 p-2 text-sm" value={comment} onChange={(event) => setComment(event.target.value)} />
                    <div className="mt-3 flex gap-2">
                      <Button disabled={busy === issue.id} onClick={() => mutate(issue.id, () => api(`/api/issues/${issue.id}`, { method: "PATCH", body: JSON.stringify({ status: "resolved", comment }) }))}>Resolve</Button>
                      <Button variant="secondary" disabled={busy === issue.id} onClick={() => mutate(issue.id, () => api(`/api/issues/${issue.id}`, { method: "PATCH", body: JSON.stringify({ status: "ignored", comment }) }))}>Ignore</Button>
                      <Button variant="secondary" disabled={busy === issue.id} onClick={() => mutate(issue.id, () => api(`/api/issues/${issue.id}`, { method: "PATCH", body: JSON.stringify({ status: "reopened", comment }) }))}>Reopen</Button>
                    </div>
                  </div>
                ))}
                {!state.issues.some((issue) => issue.evalCaseId === selected.id) ? <EmptyText text="No issues for this case." /> : null}
              </div>
            </>
          ) : (
            <EmptyText text="Select or generate an eval case." />
          )}
        </Card>
      </div>
    </>
  );
}

function GradersView({ state }: { state: WorkspaceState }) {
  return (
    <>
      <PageHeader title="Graders" description="Persisted deterministic and LLM-judge grader definitions generated for this project." meta={<ProjectMeta state={state} />} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {state.graders.map((grader) => (
          <Card key={grader.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">{grader.name}</h2>
              <Badge tone={grader.health === "healthy" ? "green" : "amber"}>{grader.health}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{grader.description}</p>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-sm"><span>Agreement</span><strong>{grader.agreement.toFixed(2)}</strong></div>
              <ProgressBar value={grader.agreement * 100} tone={grader.agreement >= 0.75 ? "green" : "amber"} />
            </div>
          </Card>
        ))}
        {!state.graders.length ? <Card className="p-5"><EmptyText text="Graders are created after the first import." /></Card> : null}
      </div>
    </>
  );
}

function PromptOptimizerView({
  state,
  busy,
  mutate,
}: {
  state: WorkspaceState;
  busy: string | null;
  mutate: <T>(label: string, action: () => Promise<T>, projectId?: string) => Promise<void>;
}) {
  return (
    <>
      <PageHeader
        title="Prompt Optimizer"
        description="Prompt recommendations are generated from persisted eval results and require explicit promotion."
        actions={
          state.activeProject ? (
            <Button disabled={busy === "rerun"} onClick={() => mutate("rerun", () => api(`/api/projects/${state.activeProject?.id}/runs`, { method: "POST" }))}>
              <Play className="h-4 w-4" /> Run evaluation
            </Button>
          ) : null
        }
        meta={<ProjectMeta state={state} />}
      />
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Current prompt</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-[8px] bg-slate-50 p-4 text-xs leading-6 text-slate-700">{state.promptVersions[0]?.prompt || "Create a project to seed prompt versions."}</pre>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          {state.promptCandidates.map((candidate) => (
            <Card key={candidate.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-950">{candidate.title}</h2>
                <Badge tone={candidate.regressionRisk === "low" ? "green" : "amber"}>{candidate.regressionRisk} risk</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{candidate.explanation}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <MetricMini label="Quality lift" value={`${candidate.expectedQualityLift}%`} />
                <MetricMini label="Cost delta" value={`${candidate.expectedCostDelta}%`} />
              </div>
              <Button className="mt-5" disabled={busy === candidate.id} onClick={() => mutate(candidate.id, () => api(`/api/projects/${state.activeProject?.id}/prompt/promote`, { method: "POST", body: JSON.stringify({ candidateId: candidate.id }) }))}>
                Promote candidate
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}

function RoutingCachingView({
  state,
  busy,
  mutate,
}: {
  state: WorkspaceState;
  busy: string | null;
  mutate: <T>(label: string, action: () => Promise<T>, projectId?: string) => Promise<void>;
}) {
  return (
    <>
      <PageHeader title="Routing & Caching" description="Model routing and cache recommendations persisted for this project." actions={<ExportButton state={state} busy={busy} mutate={mutate} />} meta={<ProjectMeta state={state} />} />
      <Card className="overflow-hidden">
        <TableHeader title="Intent Routing Rules" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs font-semibold text-slate-500">
              <tr><th className="px-4 py-3">Intent</th><th>Model</th><th>Fallback</th><th>Quality</th><th>Cost</th><th>Latency</th><th>Traffic</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.routingRules.map((rule) => (
                <tr key={rule.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{rule.intent}</td>
                  <td><Badge>{rule.model}</Badge></td><td>{rule.fallback}</td><td>{rule.qualityScore}%</td><td>${rule.estimatedCost.toFixed(3)}</td><td>{rule.estimatedLatencyMs}ms</td><td>{rule.trafficShare}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {state.cacheRecommendations.map((item) => (
          <Card key={item.id} className="p-5">
            <Badge tone={item.impact === "high" ? "green" : "amber"}>{item.impact} impact</Badge>
            <h2 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.detail}</p>
            <p className="mt-4 text-sm font-semibold text-emerald-700">${item.estimatedMonthlySavings}/mo estimated savings</p>
          </Card>
        ))}
      </div>
    </>
  );
}

function ReportsView({
  state,
  busy,
  mutate,
}: {
  state: WorkspaceState;
  busy: string | null;
  mutate: <T>(label: string, action: () => Promise<T>, projectId?: string) => Promise<void>;
}) {
  const report = state.reports[0];
  return (
    <>
      <PageHeader title="Audit Report" description="Report content is generated from persisted eval cases, issues, and runs." actions={<ExportButton state={state} busy={busy} mutate={mutate} />} meta={<ProjectMeta state={state} />} />
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-500">Readiness score</h2>
          <div className="mt-4 text-5xl font-semibold text-slate-950">{report?.readinessScore ?? 0}</div>
          <p className="mt-4 text-sm leading-6 text-slate-600">{report?.summary || "Upload traces to generate a report."}</p>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">{report?.title || "No report yet"}</h2>
          <div className="mt-5 space-y-3">
            {(report?.recommendations || []).map((recommendation) => (
              <div key={recommendation} className="rounded-[8px] border border-slate-200 p-3 text-sm text-slate-700">{recommendation}</div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="mt-4 overflow-hidden">
        <TableHeader title="Audit Trail" />
        <ActivityList state={state} />
      </Card>
    </>
  );
}

function SettingsView({ state }: { state: WorkspaceState }) {
  return (
    <>
      <PageHeader title="Settings" description="Workspace and deployment readiness. Secrets are never exposed to the browser." meta={<ProjectMeta state={state} />} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Organization", state.organization.name, "Tenant boundary"],
          ["Membership role", state.membership.role, "Access control"],
          ["Storage", "Supabase Storage", "Production upload target"],
          ["Local test mode", "Explicit flag only", "No unverified success states"],
        ].map(([label, value, detail]) => <MetricCard key={label} label={label} value={value} detail={detail} tone="blue" />)}
      </div>
    </>
  );
}

function useSummary(state: WorkspaceState) {
  return useMemo(() => {
    const latest = state.evalRuns[0];
    const openIssues = state.issues.filter((issue) => issue.status === "open" || issue.status === "reopened").length;
    const intentCounts = new Map<string, number>();
    state.evalCases.forEach((item) => intentCounts.set(item.intent, (intentCounts.get(item.intent) || 0) + 1));
    const total = Math.max(1, state.evalCases.length);
    return {
      openIssues,
      passRate: latest?.passRate ?? 0,
      intentCoverage: Array.from(intentCounts.entries()).map(([intent, count]) => ({
        intent,
        percent: Math.round((count / total) * 100),
      })),
    };
  }, [state]);
}

function ProjectMeta({ state }: { state: WorkspaceState }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
      <span>Org <strong className="ml-2 text-slate-700">{state.organization.name}</strong></span>
      <span>Project <strong className="ml-2 text-slate-700">{state.activeProject?.name || "None"}</strong></span>
      <span>User <strong className="ml-2 text-slate-700">{state.user.email}</strong></span>
    </div>
  );
}

function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-600">{label}</p>
          <p className={tone === "red" ? "mt-3 text-2xl font-semibold text-red-600" : "mt-3 text-2xl font-semibold text-slate-950"}>{value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
        </div>
        {tone === "red" ? <AlertTriangle className="h-5 w-5 text-red-500" /> : <CheckCircle2 className="h-5 w-5 text-blue-600" />}
      </div>
    </Card>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[8px] border border-slate-200 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-950">{value}</p></div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input className="mt-2 h-11 w-full rounded-[7px] border border-slate-200 px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TableHeader({ title }: { title: string }) {
  return <div className="border-b border-slate-100 p-4"><h2 className="text-lg font-semibold text-slate-950">{title}</h2></div>;
}

function EmptyText({ text }: { text: string }) {
  return <p className="py-6 text-sm text-slate-500">{text}</p>;
}

function ActivityList({ state }: { state: WorkspaceState }) {
  return (
    <div className="divide-y divide-slate-100">
      {state.auditEvents.slice(0, 12).map((event) => (
        <div key={event.id} className="grid grid-cols-[1fr_auto] gap-3 p-3 text-sm">
          <span><strong className="text-slate-900">{event.action}</strong><span className="ml-2 text-slate-500">{event.entityType}</span></span>
          <span className="text-xs text-slate-500">{formatDate(event.createdAt)}</span>
        </div>
      ))}
      {!state.auditEvents.length ? <div className="p-4"><EmptyText text="Audit events appear after workspace actions." /></div> : null}
    </div>
  );
}

function ExportButton({
  state,
  busy,
  mutate,
}: {
  state: WorkspaceState;
  busy: string | null;
  mutate: <T>(label: string, action: () => Promise<T>, projectId?: string) => Promise<void>;
}) {
  return state.activeProject ? (
    <Button
      variant="secondary"
      disabled={busy === "export"}
      onClick={() =>
        mutate("export", async () => {
          const record = await api<{ id: string }>(`/api/projects/${state.activeProject?.id}/exports`, { method: "POST" });
          window.location.href = `/api/exports/${record.id}/download`;
        })
      }
    >
      <Download className="h-4 w-4" />
      Export CSV
    </Button>
  ) : null;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = init?.body instanceof FormData ? undefined : { "content-type": "application/json" };
  const response = await fetch(path, { ...init, headers: { ...headers, ...init?.headers } });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!payload.ok) throw new Error(payload.error.message);
  return payload.data;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
