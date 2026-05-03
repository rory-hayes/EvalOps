"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  History,
  Loader2,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, PageHeader, ProgressBar, type Tone } from "@/components/primitives";
import { formatEvidenceCount, normalizeCalculationBasis, normalizeConfidenceText } from "@/lib/domain/evidence";
import { SELECTED_PROJECT_STORAGE_KEY } from "@/lib/project-selection";
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

type MutateFn = <T>(
  label: string,
  action: () => Promise<T>,
  projectId?: string | null | ((result: T) => string | null | undefined),
) => Promise<void>;

export function WorkspaceApp({ view }: { view: View }) {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh(projectId?: string | null) {
    setLoading(true);
    setError(null);
    try {
      const selectedProjectId = projectId === undefined ? getStoredProjectId() : projectId || "";
      const response = await fetch(`/api/app-state${selectedProjectId ? `?projectId=${selectedProjectId}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<WorkspaceState>;
      if (!payload.ok) throw new Error(payload.error.message);
      if (payload.data.activeProject?.id) {
        rememberProject(payload.data.activeProject.id);
      }
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
    const projectSelectedListener = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.source === "workspace") return;
      const projectId = event instanceof CustomEvent ? String(event.detail?.projectId || "") : "";
      void refresh(projectId);
    };
    window.addEventListener("evalops:refresh", listener);
    window.addEventListener("evalops:project-selected", projectSelectedListener);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("evalops:refresh", listener);
      window.removeEventListener("evalops:project-selected", projectSelectedListener);
    };
  }, []);

  async function mutate<T>(
    label: string,
    action: () => Promise<T>,
    projectId?: string | null | ((result: T) => string | null | undefined),
  ) {
    setBusy(label);
    setError(null);
    try {
      const result = await action();
      const nextProjectId =
        typeof projectId === "function" ? projectId(result) : projectId;
      if (nextProjectId === null) {
        forgetProject();
        window.dispatchEvent(
          new CustomEvent("evalops:project-selected", {
            detail: { projectId: "", source: "workspace" },
          }),
        );
      } else if (nextProjectId) {
        rememberProject(nextProjectId);
        window.dispatchEvent(
          new CustomEvent("evalops:project-selected", {
            detail: { projectId: nextProjectId, source: "workspace" },
          }),
        );
      }
      await refresh(nextProjectId === null ? null : nextProjectId || state?.activeProject?.id);
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
        <GradersView state={state} busy={busy} mutate={mutate} />
      ) : view === "prompt-optimizer" ? (
        <PromptOptimizerView state={state} busy={busy} mutate={mutate} />
      ) : view === "routing-caching" ? (
        <RoutingCachingView state={state} busy={busy} mutate={mutate} />
      ) : view === "reports" ? (
        <ReportsView state={state} busy={busy} mutate={mutate} />
      ) : (
        <SettingsView state={state} busy={busy} mutate={mutate} />
      )}
    </>
  );
}

function getStoredProjectId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY) || "";
}

function rememberProject(projectId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, projectId);
}

function forgetProject() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
}

function DashboardView({
  state,
  busy,
  mutate,
}: {
  state: WorkspaceState;
  busy: string | null;
  mutate: MutateFn;
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
          ["Eval results", state.evalResults.length, "Executed grader evidence", "blue"],
          ["Open issues", summary.openIssues, "Reviewer action required", summary.openIssues ? "red" : "green"],
          ["Pass rate", `${summary.passRate}%`, "Latest persisted run", "blue"],
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
  mutate: MutateFn;
}) {
  const [form, setForm] = useState({
    name: "Support Assistant Audit",
    workflowType: "support_assistant",
    objective: "Measure end-to-end answer quality, escalation accuracy, and billing/refund reliability.",
    riskPreferences: "Billing, Escalation, Privacy",
    primaryGoals: "Answer quality, safe escalation, refund accuracy",
    privacyMode: "redact_pii",
  });
  const generatedPreview = [
    "Intent taxonomy and coverage map",
    "Golden, regression, edge, and safety eval cases",
    "Deterministic and judge-style grader pack",
    "Prompt, routing, caching, and executive report draft",
  ];

  return (
    <>
      <PageHeader
        title="Projects"
        description="Create a tenant-scoped project. Creation writes organization, membership, project, optimization seed, and audit records."
        meta={<ProjectMeta state={state} />}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_460px]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Create New Project</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Define the audit boundary, quality goals, and privacy posture before any traces are retained.
          </p>
          <form
            className="mt-5 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              mutate("create-project", async () => {
                const created = await api<{ id: string }>("/api/projects", {
                  method: "POST",
                  body: JSON.stringify({
                    ...form,
                    riskPreferences: [
                      ...form.riskPreferences.split(","),
                      ...form.primaryGoals.split(","),
                    ].map((item) => item.trim()).filter(Boolean),
                  }),
                });
                return created;
              }, (created) => created.id);
            }}
          >
            <Field label="Project name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
            <SelectField
              label="Workflow type"
              value={form.workflowType}
              onChange={(workflowType) => setForm({ ...form, workflowType })}
              options={[
                ["support_assistant", "Support Assistant"],
                ["rag", "RAG Knowledge Assistant"],
                ["tool_agent", "Tool-Using Agent"],
                ["document_extraction", "Document Extraction"],
                ["custom", "Custom"],
              ]}
            />
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Evaluation objective</span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-[7px] border border-slate-200 p-3 text-sm leading-6"
                value={form.objective}
                onChange={(event) => setForm({ ...form, objective: event.target.value })}
              />
            </label>
            <Field label="Primary risks" value={form.riskPreferences} onChange={(riskPreferences) => setForm({ ...form, riskPreferences })} />
            <Field label="Primary goals" value={form.primaryGoals} onChange={(primaryGoals) => setForm({ ...form, primaryGoals })} />
            <SelectField
              label="Privacy preference"
              value={form.privacyMode}
              onChange={(privacyMode) => setForm({ ...form, privacyMode })}
              options={[
                ["redact_pii", "Redact likely PII"],
                ["short_retention", "Short raw-data retention"],
                ["derived_only", "Store derived evals only"],
              ]}
            />
            <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">What EvalOps will generate</h3>
              <div className="mt-3 grid gap-2">
                {generatedPreview.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-blue-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
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
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={project.id === state.activeProject?.id ? "blue" : "slate"}>
                        {project.id === state.activeProject?.id ? "Selected" : project.status}
                      </Badge>
                      {project.id !== state.activeProject?.id ? (
                        <Button
                          variant="secondary"
                          className="h-8 px-3 text-xs"
                          disabled={busy === `select-${project.id}`}
                          onClick={() => mutate(`select-${project.id}`, async () => null, project.id)}
                        >
                          Open
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{project.objective}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {project.riskPreferences.slice(0, 4).map((item) => (
                      <Badge key={item} tone="slate">{item}</Badge>
                    ))}
                    <Badge tone="blue">{privacyModeLabel(project.privacyMode)}</Badge>
                  </div>
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
  mutate: MutateFn;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [redactionEnabled, setRedactionEnabled] = useState(true);
  const [derivedOnly, setDerivedOnly] = useState(false);
  const project = state.activeProject;
  const selectedSource = selectedFile ? inferSourceLabel(selectedFile.name, selectedFile.type) : "Awaiting file";
  const latestJob = state.processingJobs[0];
  const progress = busy === "upload"
    ? 45
    : latestJob?.status === "completed"
      ? 100
      : latestJob?.status === "failed"
        ? 100
        : latestJob
          ? 70
          : 0;
  return (
    <>
      <PageHeader
        title="Trace Import"
        description="Upload CSV, JSON, NDJSON, or TXT traces. Files are stored, parsed, redacted, processed, and audited by the backend."
        meta={<ProjectMeta state={state} />}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card className="p-6">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,.ndjson,.jsonl,.txt"
            className="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              setSelectedFile(file ? { name: file.name, size: file.size, type: file.type } : null);
            }}
          />
          <div className="rounded-[8px] border border-dashed border-blue-200 bg-blue-50/30 p-8 text-center">
            <UploadCloud className="mx-auto h-10 w-10 text-blue-600" />
            <h2 className="mt-4 text-lg font-semibold text-slate-950">Upload trace file</h2>
            <p className="mt-2 text-sm text-slate-600">Browser upload posts to the backend, then Supabase Storage or the test store persists the file.</p>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button variant="secondary" type="button" disabled={!project || busy === "upload"} onClick={() => fileRef.current?.click()}>
                Choose file
              </Button>
              <Button
                type="button"
                disabled={!project || !selectedFile || busy === "upload"}
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
            <p className="mt-3 text-xs font-medium text-slate-500">
              {selectedFile ? `Selected: ${selectedFile.name}` : "No file selected"}
            </p>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <Card className="border-slate-200 bg-white p-4 shadow-none">
              <h2 className="text-sm font-semibold text-slate-950">Validation feedback</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {selectedFile
                  ? `${selectedSource} recognized. ${formatBytes(selectedFile.size)} ready for backend validation.`
                  : "Choose a CSV, JSON, NDJSON, JSONL, or TXT file to preview validation."}
              </p>
            </Card>
            <Card className="border-slate-200 bg-white p-4 shadow-none">
              <h2 className="text-sm font-semibold text-slate-950">Schema mapping preview</h2>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {schemaPreview(selectedSource).map(([field, source]) => (
                  <div key={field} className="flex items-center justify-between gap-3">
                    <span>{field}</span>
                    <Badge tone="slate">{source}</Badge>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="border-slate-200 bg-white p-4 shadow-none">
              <h2 className="text-sm font-semibold text-slate-950">Import progress</h2>
              <div className="mt-3">
                <ProgressBar value={progress} tone={latestJob?.status === "failed" ? "red" : "blue"} />
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {busy === "upload" ? "Uploading and parsing..." : latestJob?.status || "Waiting for upload"}
              </p>
            </Card>
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
          <h2 className="text-lg font-semibold text-slate-950">Redaction controls</h2>
          <div className="mt-4 space-y-3">
            <CheckboxRow
              checked={redactionEnabled}
              onChange={setRedactionEnabled}
              label="PII redaction"
              detail="Detect likely email, card, phone, and token values before review."
            />
            <CheckboxRow
              checked={derivedOnly}
              onChange={setDerivedOnly}
              label="Store derived evals only"
              detail="MVP control for minimizing raw trace retention after artifact generation."
            />
            <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Raw trace retention: <strong>14 days</strong> for private MVP uploads.
            </div>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-5">
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
  mutate: MutateFn;
}) {
  const [caseFilter, setCaseFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(state.evalCases[0]?.id || null);
  const filteredCases = useMemo(
    () =>
      state.evalCases.filter((item) =>
        caseFilter === "all" ||
        item.set === caseFilter ||
        item.risk === caseFilter ||
        item.status === caseFilter,
      ),
    [caseFilter, state.evalCases],
  );
  const selected = filteredCases.find((item) => item.id === selectedId) || filteredCases[0] || state.evalCases[0];
  const caseInputRef = useRef<HTMLTextAreaElement | null>(null);
  const expectedBehaviorRef = useRef<HTMLTextAreaElement | null>(null);
  const acceptanceCriteriaRef = useRef<HTMLTextAreaElement | null>(null);
  const [comment, setComment] = useState("Reviewed and accepted remediation.");

  return (
    <>
      <PageHeader
        title="Eval Builder"
        description="Generated eval cases are persisted from imported traces and can be reviewed, updated, and exported."
        actions={<ExportButton state={state} busy={busy} mutate={mutate} />}
        meta={<ProjectMeta state={state} />}
      />
      <Card className="mb-4 p-4">
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <SelectField
            label="Filter eval cases"
            value={caseFilter}
            onChange={setCaseFilter}
            options={[
              ["all", "All cases"],
              ["golden", "Golden set"],
              ["regression", "Regression set"],
              ["edge", "Edge cases"],
              ["safety", "Safety/adversarial"],
              ["high", "High risk"],
              ["failed", "Failed"],
              ["review", "Needs review"],
            ]}
          />
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Bulk tagging</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {["Move to regression", "Mark high risk", "Tag known failure", "Queue export"].map((action) => (
                <Button key={action} variant="secondary" className="h-8 px-3 text-xs" disabled={!state.evalCases.length}>
                  {action}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              MVP affordance for batch review; persistence can reuse the eval-case update route next.
            </p>
          </div>
        </div>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card className="overflow-hidden">
          <TableHeader title={`Eval Cases (${filteredCases.length})`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                <tr><th className="px-4 py-3">Case</th><th>Intent</th><th>Source</th><th>Set</th><th>Risk</th><th>Status</th><th>Result</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCases.map((item) => (
                  <tr key={item.id} className={item.id === selected?.id ? "bg-blue-50/50" : ""} onClick={() => setSelectedId(item.id)}>
                    <td className="px-4 py-3"><button className="text-left font-semibold text-blue-700">{item.name}</button></td>
                    <td>{item.intent}</td><td>{item.source}</td><td>{item.set}</td>
                    <td><Badge tone={item.risk === "high" ? "red" : item.risk === "medium" ? "amber" : "green"}>{item.risk}</Badge></td>
                    <td><Badge tone={item.status === "passed" ? "green" : item.status === "failed" ? "red" : "amber"}>{item.status}</Badge></td>
                    <td>{item.lastResult}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredCases.length ? <EmptyText text="Upload traces or adjust filters to see eval cases." /> : null}
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
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="font-semibold text-slate-900">Inline case editing</h3>
                <label className="mt-3 block">
                  <span className="text-sm font-semibold text-slate-700">Case input</span>
                  <textarea
                    key={`${selected.id}-input`}
                    ref={caseInputRef}
                    aria-label="Case input"
                    className="mt-2 min-h-20 w-full rounded-[7px] border border-slate-200 p-2 text-sm"
                    defaultValue={selected.userInput}
                  />
                </label>
                <label className="mt-3 block">
                  <span className="text-sm font-semibold text-slate-700">Expected behavior draft</span>
                  <textarea
                    key={`${selected.id}-behavior`}
                    ref={expectedBehaviorRef}
                    aria-label="Expected behavior draft"
                    className="mt-2 min-h-20 w-full rounded-[7px] border border-slate-200 p-2 text-sm"
                    defaultValue={selected.expectedBehavior}
                  />
                </label>
                <label className="mt-3 block">
                  <span className="text-sm font-semibold text-slate-700">Acceptance criteria</span>
                  <textarea
                    key={`${selected.id}-criteria`}
                    ref={acceptanceCriteriaRef}
                    aria-label="Acceptance criteria"
                    className="mt-2 min-h-20 w-full rounded-[7px] border border-slate-200 p-2 text-sm"
                    defaultValue={selected.acceptanceCriteria.join("\n")}
                  />
                </label>
                <Button
                  className="mt-3"
                  variant="secondary"
                  disabled={busy === selected.id}
                  onClick={() =>
                    mutate(selected.id, () =>
                      api(`/api/eval-cases/${selected.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({
                          userInput: caseInputRef.current?.value || selected.userInput,
                          expectedBehavior: expectedBehaviorRef.current?.value || selected.expectedBehavior,
                          acceptanceCriteria: (acceptanceCriteriaRef.current?.value || selected.acceptanceCriteria.join("\n"))
                            .split("\n")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        }),
                      }),
                    )
                  }
                >
                  Save case edits
                </Button>
              </div>
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
                    <div className="mt-3 space-y-2">
                      {state.issueComments.filter((item) => item.issueId === issue.id).map((item) => (
                        <div key={item.id} className="rounded-[7px] bg-slate-50 p-2 text-xs leading-5 text-slate-600">
                          <span className="font-semibold text-slate-800">{item.actorUserId}</span>
                          <span className="ml-2 text-slate-400">{formatDate(item.createdAt)}</span>
                          <p className="mt-1">{item.body}</p>
                        </div>
                      ))}
                    </div>
                    <textarea
                      aria-label="Review comment"
                      className="mt-3 min-h-20 w-full rounded-[7px] border border-slate-200 p-2 text-sm"
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                    />
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

function GradersView({
  state,
  busy,
  mutate,
}: {
  state: WorkspaceState;
  busy: string | null;
  mutate: MutateFn;
}) {
  const [selectedId, setSelectedId] = useState(state.graders[0]?.id || "");
  const selected = state.graders.find((grader) => grader.id === selectedId) || state.graders[0];
  const labeledCount = state.humanLabels.length;
  const disagreementCount = state.graderCalibrationResults.filter((item) => item.disagreementSeverity !== "none").length;
  const nextReview = disagreementCount ? `${disagreementCount} disagreement${disagreementCount === 1 ? "" : "s"} open` : "After 20 new cases";

  return (
    <>
      <PageHeader
        title="Graders"
        description="Persisted deterministic and LLM-judge grader definitions generated for this project."
        actions={
          <Button variant="secondary" disabled>
            <Plus className="h-4 w-4" />
            Add grader
          </Button>
        }
        meta={<ProjectMeta state={state} />}
      />
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Threshold configuration</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Pilot defaults apply across generated graders. Edit each grader below to pause weak definitions or update judge model notes.
          </p>
          <div className="mt-4 space-y-4">
            {[
              ["Pass threshold", selected ? Math.round(selected.passThreshold * 100) : 80],
              ["Manual review band", selected ? Math.round(selected.reviewThreshold * 100) : 60],
              ["Disagreement warning", selected ? selected.agreement : 0.75],
            ].map(([label, value]) => (
              <div key={label} className="text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-slate-700">{label}</span>
                  <strong>{typeof value === "number" && value < 1 ? value.toFixed(2) : `${value}%`}</strong>
                </div>
                <input
                  aria-label={String(label)}
                  type="range"
                  min="0"
                  max={typeof value === "number" && value < 1 ? "1" : "100"}
                  step={typeof value === "number" && value < 1 ? "0.01" : "1"}
                  value={value}
                  readOnly
                  className="w-full accent-blue-600"
                />
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Calibration reference set</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            {[
              ["Human-labeled cases", String(labeledCount)],
              ["Reference disagreements", String(disagreementCount)],
              ["Next calibration review", nextReview],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 rounded-[7px] bg-slate-50 p-3">
                <span>{label}</span>
                <strong className="text-slate-950">{value}</strong>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Health warnings</h2>
          <div className="mt-4 space-y-3">
            <WarningRow title="Low agreement review" detail="Escalation and billing graders are highlighted when agreement drops below threshold." />
            <WarningRow title="Evidence-backed calibration" detail={`${state.evalResults.length} executed result${state.evalResults.length === 1 ? "" : "s"} available for judge review.`} />
          </div>
        </Card>
      </div>
      <Card className="mb-4 p-5">
        {selected ? (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <SelectField
              label="Review grader"
              value={selected.id}
              onChange={setSelectedId}
              options={state.graders.map((grader): [string, string] => [grader.id, grader.name])}
            />
            <GraderEditor key={selected.id} state={state} grader={selected} busy={busy} mutate={mutate} />
          </div>
        ) : (
          <EmptyText text="Graders are created after the first successful import." />
        )}
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {state.graders.map((grader) => (
          <Card key={grader.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">{grader.name}</h2>
              <div className="flex flex-col items-end gap-2">
                <Badge tone={grader.active ? "blue" : "slate"}>{grader.active ? "active" : "paused"}</Badge>
                <Badge tone={grader.health === "healthy" ? "green" : "amber"}>{grader.health}</Badge>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{grader.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="slate">{grader.type === "llm_judge" ? "LLM-as-judge" : "Deterministic"}</Badge>
              {grader.model ? <Badge tone="blue">{grader.model}</Badge> : null}
            </div>
            <div className="mt-4 rounded-[8px] bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-900">Rubric</h3>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
                <li>Checks required outcome and forbidden behavior.</li>
                <li>Requires evidence from trace or policy context.</li>
                <li>Routes borderline scores to human review.</li>
              </ul>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-sm"><span>Agreement</span><strong>{grader.agreement.toFixed(2)}</strong></div>
              <ProgressBar value={grader.agreement * 100} tone={grader.agreement >= 0.75 ? "green" : "amber"} />
            </div>
            <div className="mt-4 text-xs leading-5 text-slate-500">
              {state.graderCalibrationResults.filter((item) => item.graderId === grader.id && item.reviewStatus === "open").length} open calibration review{state.graderCalibrationResults.filter((item) => item.graderId === grader.id && item.reviewStatus === "open").length === 1 ? "" : "s"}
            </div>
          </Card>
        ))}
        {!state.graders.length ? <Card className="p-5"><EmptyText text="Graders are created after the first import." /></Card> : null}
      </div>
    </>
  );
}

function GraderEditor({
  state,
  grader,
  busy,
  mutate,
}: {
  state: WorkspaceState;
  grader: WorkspaceState["graders"][number];
  busy: string | null;
  mutate: MutateFn;
}) {
  const [descriptionDraft, setDescriptionDraft] = useState(grader.description);
  const [modelDraft, setModelDraft] = useState(grader.model || "");
  const [activeDraft, setActiveDraft] = useState(grader.active);
  const [passThresholdDraft, setPassThresholdDraft] = useState(String(Math.round(grader.passThreshold * 100)));
  const [reviewThresholdDraft, setReviewThresholdDraft] = useState(String(Math.round(grader.reviewThreshold * 100)));
  const [rubricDraft, setRubricDraft] = useState(grader.rubric || grader.description);
  const [failureModesDraft, setFailureModesDraft] = useState((grader.failureModes || []).join("\n"));
  const referenceCase = state.evalCases[0];
  const existingLabel = referenceCase
    ? state.humanLabels.find((item) => item.evalCaseId === referenceCase.id && item.graderId === grader.id)
    : undefined;
  const latestResult = referenceCase
    ? state.evalResults.find((item) => item.evalCaseId === referenceCase.id && item.graderId === grader.id)
    : undefined;
  const [labelScoreDraft, setLabelScoreDraft] = useState(String(existingLabel?.score ?? latestResult?.score ?? 75));
  const [labelStatusDraft, setLabelStatusDraft] = useState(existingLabel?.status || latestResult?.status || "review");
  const [labelNotesDraft, setLabelNotesDraft] = useState(existingLabel?.notes || "Reference score from calibration review.");

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Rubric description</span>
          <textarea
            aria-label="Grader description"
            className="mt-2 min-h-28 w-full rounded-[7px] border border-slate-200 p-3 text-sm leading-6"
            value={descriptionDraft}
            onChange={(event) => setDescriptionDraft(event.target.value)}
          />
        </label>
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Judge model</span>
            <input
              aria-label="Judge model"
              className="mt-2 h-11 w-full rounded-[7px] border border-slate-200 px-3 text-sm"
              value={modelDraft}
              placeholder={grader.type === "deterministic" ? "Not required" : "gpt-5.5"}
              onChange={(event) => setModelDraft(event.target.value)}
            />
          </label>
          <CheckboxRow
            checked={activeDraft}
            onChange={setActiveDraft}
            label="Active in audit runs"
            detail="Paused graders remain visible for review but are not counted as active pilot checks."
          />
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Pass threshold</span>
            <input
              aria-label="Pass threshold percent"
              type="number"
              min="0"
              max="100"
              className="mt-2 h-11 w-full rounded-[7px] border border-slate-200 px-3 text-sm"
              value={passThresholdDraft}
              onChange={(event) => setPassThresholdDraft(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Review threshold</span>
            <input
              aria-label="Review threshold percent"
              type="number"
              min="0"
              max="100"
              className="mt-2 h-11 w-full rounded-[7px] border border-slate-200 px-3 text-sm"
              value={reviewThresholdDraft}
              onChange={(event) => setReviewThresholdDraft(event.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Rubric</span>
          <textarea
            aria-label="Grader rubric"
            className="mt-2 min-h-24 w-full rounded-[7px] border border-slate-200 p-3 text-sm leading-6"
            value={rubricDraft}
            onChange={(event) => setRubricDraft(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Failure modes</span>
          <textarea
            aria-label="Failure modes"
            className="mt-2 min-h-24 w-full rounded-[7px] border border-slate-200 p-3 text-sm leading-6"
            value={failureModesDraft}
            onChange={(event) => setFailureModesDraft(event.target.value)}
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          disabled={busy === grader.id || descriptionDraft.trim().length < 10}
          onClick={() =>
            mutate(grader.id, () =>
              api(`/api/graders/${grader.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                  description: descriptionDraft,
                  active: activeDraft,
                  model: modelDraft.trim() || null,
                  passThreshold: clampPercent(passThresholdDraft) / 100,
                  reviewThreshold: clampPercent(reviewThresholdDraft) / 100,
                  rubric: rubricDraft,
                  failureModes: failureModesDraft.split("\n").map((item) => item.trim()).filter(Boolean),
                }),
              }),
            )
          }
        >
          {busy === grader.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save grader config
        </Button>
        <p className="text-xs leading-5 text-slate-500">
          Changes persist immediately and are audit logged for pilot review.
        </p>
      </div>
      <div className="mt-5 rounded-[8px] border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-semibold text-slate-900">Human reference label</h3>
        {referenceCase ? (
          <>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Calibrate against <strong>{referenceCase.name}</strong>. Latest judge score: {latestResult ? `${latestResult.score}% ${latestResult.status}` : "not run yet"}.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-[120px_150px_1fr]">
              <input
                aria-label="Human reference score"
                type="number"
                min="0"
                max="100"
                className="h-11 rounded-[7px] border border-slate-200 px-3 text-sm"
                value={labelScoreDraft}
                onChange={(event) => setLabelScoreDraft(event.target.value)}
              />
              <select
                aria-label="Human reference status"
                className="h-11 rounded-[7px] border border-slate-200 px-3 text-sm"
                value={labelStatusDraft}
                onChange={(event) => setLabelStatusDraft(event.target.value as "passed" | "failed" | "review")}
              >
                <option value="passed">passed</option>
                <option value="review">review</option>
                <option value="failed">failed</option>
              </select>
              <input
                aria-label="Human label notes"
                className="h-11 rounded-[7px] border border-slate-200 px-3 text-sm"
                value={labelNotesDraft}
                onChange={(event) => setLabelNotesDraft(event.target.value)}
              />
            </div>
            <Button
              className="mt-3"
              variant="secondary"
              disabled={busy === `${grader.id}-label`}
              onClick={() =>
                mutate(`${grader.id}-label`, () =>
                  api(`/api/eval-cases/${referenceCase.id}/labels`, {
                    method: "POST",
                    body: JSON.stringify({
                      graderId: grader.id,
                      score: clampPercent(labelScoreDraft),
                      status: labelStatusDraft,
                      notes: labelNotesDraft,
                    }),
                  }),
                )
              }
            >
              Save reference label
            </Button>
          </>
        ) : (
          <EmptyText text="Generate eval cases before adding human labels." />
        )}
      </div>
    </div>
  );
}

function PromptOptimizerView({
  state,
  busy,
  mutate,
}: {
  state: WorkspaceState;
  busy: string | null;
  mutate: MutateFn;
}) {
  const [candidateToPromote, setCandidateToPromote] = useState<
    WorkspaceState["promptCandidates"][number] | null
  >(null);

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
        <div className="space-y-4">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Current prompt</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-[8px] bg-slate-50 p-4 text-xs leading-6 text-slate-700">{state.promptVersions[0]?.prompt || "Create a project to seed prompt versions."}</pre>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Likely prompt issues</h2>
          <div className="mt-4 space-y-3">
            {[
              "Escalation policy is present but not tied to customer frustration signals.",
              "Billing/refund instructions lack confirmation language before action.",
              "Formatting guidance does not separate evidence from recommendation.",
            ].map((issue) => (
              <WarningRow key={issue} title={issue} detail="Mocked from latest eval failures for Milestone 1." />
            ))}
          </div>
        </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {state.promptCandidates.map((candidate) => (
            <Card key={candidate.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-950">{candidate.title}</h2>
                <Badge tone={candidate.regressionRisk === "low" ? "green" : "amber"}>{candidate.regressionRisk} risk</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{candidate.explanation}</p>
              <div className="mt-4 rounded-[8px] bg-slate-50 p-3">
                <h3 className="text-sm font-semibold text-slate-900">Candidate prompt body</h3>
                <pre className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-700">{candidate.promptBody}</pre>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm xl:grid-cols-4">
                <MetricMini label="Quality lift" value={`${candidate.expectedQualityLift}%`} />
                <MetricMini label="Cost delta" value={`${candidate.expectedCostDelta}%`} />
                <MetricMini label="Latency" value={`${candidate.expectedLatencyDeltaMs && candidate.expectedLatencyDeltaMs > 0 ? "+" : ""}${candidate.expectedLatencyDeltaMs ?? 0}ms`} />
                <MetricMini label="Pass rate" value={`${candidate.baselinePassRate ?? 0}% -> ${candidate.candidatePassRate ?? 0}%`} />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {candidate.diffSummary || "Prompt diff summary pending."} {normalizeConfidenceText(candidate.confidence)} · {formatEvidenceCount(candidate.evidenceRefs)}
              </p>
              <Button
                className="mt-5"
                disabled={busy === candidate.id}
                onClick={() => setCandidateToPromote(candidate)}
              >
                Promote candidate
              </Button>
            </Card>
          ))}
        </div>
      </div>
      {candidateToPromote ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="promote-prompt-title"
            className="w-full max-w-lg rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_28px_90px_rgba(15,23,42,0.28)]"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 id="promote-prompt-title" className="text-lg font-semibold text-slate-950">
                  Promote prompt candidate
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Applying <strong>{candidateToPromote.title}</strong> will create a new current prompt version for this project and affect subsequent evaluations.
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-[8px] bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              Review the expected quality lift, cost delta, and regression risk before applying this candidate.
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => setCandidateToPromote(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={busy === candidateToPromote.id}
                onClick={() => {
                  const candidateId = candidateToPromote.id;
                  const projectId = state.activeProject?.id;
                  setCandidateToPromote(null);
                  void mutate(candidateId, () => {
                    if (!projectId) throw new Error("Select a project before promoting a prompt.");
                    return api(`/api/projects/${projectId}/prompt/promote`, {
                      method: "POST",
                      body: JSON.stringify({ candidateId }),
                    });
                  });
                }}
              >
                Apply prompt
              </Button>
            </div>
          </div>
        </div>
      ) : null}
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
  mutate: MutateFn;
}) {
  const highRiskRoutes = state.routingRules.filter((rule) => /human review|gpt-4\.1$/i.test(rule.fallback));
  return (
    <>
      <PageHeader title="Routing & Caching" description="Model routing and cache recommendations persisted for this project." actions={<ExportButton state={state} busy={busy} mutate={mutate} />} meta={<ProjectMeta state={state} />} />
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">High-risk route review</h2>
          <div className="mt-4 space-y-3">
            {highRiskRoutes.length ? highRiskRoutes.map((rule) => (
              <div key={rule.id} className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-slate-950">{rule.intent}</strong>
                  <Badge tone="amber">{rule.fallback}</Badge>
                </div>
                <p className="mt-2 leading-6 text-amber-800">
                  {normalizeCalculationBasis(rule.calculationBasis, "Route through stronger model or human review until regression pass rate improves.")}
                </p>
                <p className="mt-2 text-xs text-amber-700">{normalizeConfidenceText(rule.confidence)} · {formatEvidenceCount(rule.evidenceRefs)}</p>
              </div>
            )) : <EmptyText text="High-risk route callouts appear after project setup." />}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Operational actions</h2>
          <div className="mt-4 space-y-3">
            {[
              "Route Privacy and Escalation intents to human-review fallback.",
              "Keep Billing on stronger fallback until refund grader agreement clears 0.80.",
              "Track cache hit-rate after moving static policy text to the prompt prefix.",
            ].map((action) => (
              <div key={action} className="flex items-start gap-2 rounded-[8px] bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-blue-600" />
                <span>{action}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
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
            <p className="mt-3 text-xs leading-5 text-slate-500">{normalizeCalculationBasis(item.calculationBasis)} {normalizeConfidenceText(item.confidence)} · {formatEvidenceCount(item.evidenceRefs)}</p>
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
  mutate: MutateFn;
}) {
  const report = state.reports[0];
  const summary = useSummary(state);
  return (
    <>
      <PageHeader
        title="Audit Report"
        description="Report content is generated from persisted eval cases, issues, and runs."
        actions={
          <>
            <ExportButton state={state} busy={busy} mutate={mutate} />
            <PdfExportButton state={state} busy={busy} mutate={mutate} />
          </>
        }
        meta={<ProjectMeta state={state} />}
      />
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-500">Eval health score</h2>
          <div className="mt-4 text-5xl font-semibold text-slate-950">{report?.readinessScore ?? 0}</div>
          <p className="mt-4 text-sm leading-6 text-slate-600">{report?.summary || "Upload traces to generate a report."}</p>
          <p className="mt-3 text-xs leading-5 text-slate-500">{normalizeConfidenceText(report?.confidence)} · {formatEvidenceCount(report?.evidenceRefs)}</p>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Executive summary</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{report?.summary || "The first audit report appears after trace import."}</p>
          <h3 className="mt-5 text-sm font-semibold text-slate-900">Prioritized recommendations</h3>
          <div className="mt-5 space-y-3">
            {(report?.recommendations || []).map((recommendation) => (
              <div key={recommendation} className="rounded-[8px] border border-slate-200 p-3 text-sm text-slate-700">{recommendation}</div>
            ))}
          </div>
          {report?.structuredSections?.length ? (
            <div className="mt-5 space-y-3">
              {report.structuredSections.map((section) => (
                <div key={section.title} className="rounded-[8px] bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  <strong className="text-slate-950">{section.title}</strong>
                  <p className="mt-1">{section.body}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatEvidenceCount(section.evidenceRefs)}</p>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Top risks</h2>
          <div className="mt-4 space-y-3">
            {(state.failureClusters.length ? state.failureClusters : [
              { id: "risk_empty", label: "Coverage gaps not assessed yet", severity: "medium", issueCount: 0, percent: 0 },
            ]).map((cluster) => (
              <div key={cluster.id} className="flex items-center justify-between gap-3 rounded-[8px] bg-slate-50 p-3 text-sm">
                <span className="font-medium text-slate-800">{cluster.label}</span>
                <Badge tone={cluster.severity === "high" ? "red" : "amber"}>{cluster.issueCount} issues</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Coverage map</h2>
          <div className="mt-4 space-y-3">
            {summary.intentCoverage.length ? summary.intentCoverage.map((item) => (
              <div key={item.intent} className="grid grid-cols-[110px_1fr_44px] items-center gap-3 text-sm">
                <span className="truncate text-slate-700">{item.intent}</span>
                <ProgressBar value={item.percent} tone={item.percent >= 60 ? "green" : "amber"} />
                <strong className="text-right">{item.percent}%</strong>
              </div>
            )) : <EmptyText text="Coverage appears after trace import." />}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Baseline scorecard</h2>
          <div className="mt-4 grid gap-3">
            <MetricMini label="Pass rate" value={`${summary.passRate}%`} />
            <MetricMini label="Eval results" value={String(state.evalResults.length)} />
            <MetricMini label="Human labels" value={String(state.humanLabels.length)} />
          </div>
        </Card>
      </div>
      <Card className="mt-4 p-5">
        <h2 className="text-lg font-semibold text-slate-950">Business impact opportunities</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ["Reduce support escalations", "Convert repeated failure clusters into regression tests."],
            ["Lower model spend", "Use caching and intent routing where risk is low."],
            ["Protect launch quality", "Gate prompt changes behind eval pack export and review."],
          ].map(([title, detail]) => (
            <div key={title} className="rounded-[8px] border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="mt-4 overflow-hidden">
        <TableHeader title="Audit Trail" />
        <ActivityList state={state} />
      </Card>
    </>
  );
}

function SettingsView({
  state,
  busy,
  mutate,
}: {
  state: WorkspaceState;
  busy: string | null;
  mutate: MutateFn;
}) {
  const project = state.activeProject;
  const inventory = useDataInventory(state);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Workspace and deployment readiness. Secrets are never exposed to the browser."
        actions={
          <form method="post" action="/logout">
            <Button type="submit" variant="secondary">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        }
        meta={<ProjectMeta state={state} />}
      />
      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge tone="blue">Private pilot controls</Badge>
            <h2 className="mt-3 text-lg font-semibold text-slate-950">Workspace settings are provisioned; project privacy is editable</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Organization name, membership role, and storage target are fixed by authentication and deployment configuration for this milestone. Project privacy posture and risk tags persist here and are audit logged.
            </p>
          </div>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Organization", state.organization.name, "Provisioned tenant boundary"],
          ["Membership role", state.membership.role, "Provisioned access control"],
          ["Storage", "Supabase Storage", "Configured upload target"],
          ["Local test mode", "Explicit flag only", "Guarded by environment"],
        ].map(([label, value, detail]) => <MetricCard key={label} label={label} value={value} detail={detail} tone="blue" />)}
      </div>
      <Card className="mt-4 p-5">
        <h2 className="text-lg font-semibold text-slate-950">Provisioned values</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <ReadOnlySetting label="Organization name" value={state.organization.name} />
          <ReadOnlySetting label="Your role" value={state.membership.role} />
          <ReadOnlySetting label="Trace storage target" value="Supabase Storage" />
        </div>
      </Card>
      <SettingsPrivacyCard
        key={`${project?.id || "no-project"}-${project?.updatedAt || ""}`}
        project={project}
        state={state}
        busy={busy}
        mutate={mutate}
      />
      <Card className="mt-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Data Inventory</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Project-scoped records currently visible in the workspace state.
            </p>
          </div>
          <Badge tone="slate">{project ? project.name : "No project selected"}</Badge>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <InventoryMetric label="Raw uploads" value={inventory.rawUploads} detail={`${inventory.retainedUploads} retained / ${inventory.purgedUploads} purged`} />
          <InventoryMetric label="Raw traces" value={inventory.rawTraces} detail={`${inventory.retainedTraces} retained / ${inventory.purgedTraces} purged`} />
          <InventoryMetric label="Derived eval artifacts" value={inventory.derivedArtifacts} detail="Cases, graders, runs, reports, recommendations" />
          <InventoryMetric label="Exports" value={inventory.exports} detail={`${inventory.generatedExports} generated / ${inventory.pendingExports} pending`} />
          <InventoryMetric label="Audit / receipt records" value={inventory.auditRecords} detail={`${state.auditEvents.length} audit events / ${state.dataOperationReceipts.length} receipts`} />
        </div>
      </Card>
      <Card className="mt-4 p-5">
        <h2 className="text-lg font-semibold text-slate-950">Data controls</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Live exports are generated from persisted audit artifacts. Full project export and deletion create customer-visible receipts.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ExportButton state={state} busy={busy} mutate={mutate} />
          <PdfExportButton state={state} busy={busy} mutate={mutate} />
          <FullProjectExportButton state={state} busy={busy} mutate={mutate} />
          <DeleteProjectButton state={state} busy={busy} mutate={mutate} />
        </div>
      </Card>
      <SettingsHistoryCard state={state} />
    </>
  );
}

function SettingsPrivacyCard({
  project,
  state,
  busy,
  mutate,
}: {
  project: WorkspaceState["activeProject"];
  state: WorkspaceState;
  busy: string | null;
  mutate: MutateFn;
}) {
  const [privacyMode, setPrivacyMode] = useState(project?.privacyMode || "redact_pii");
  const [riskPreferences, setRiskPreferences] = useState(project?.riskPreferences.join(", ") || "");

  return (
    <>
      <Card className="mt-4 p-5">
        <h2 className="text-lg font-semibold text-slate-950">Privacy controls</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          These controls affect future imports and generated artifacts for the selected project. Existing exports remain audit records.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
          <SelectField
            label="Privacy posture"
            value={privacyMode}
            onChange={(value) => setPrivacyMode(value as typeof privacyMode)}
            options={[
              ["redact_pii", "Redact likely PII"],
              ["short_retention", "Short raw-data retention"],
              ["derived_only", "Store derived evals only"],
            ]}
          />
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Project risks and goals</span>
            <textarea
              aria-label="Project risks and goals"
              className="mt-2 min-h-24 w-full rounded-[7px] border border-slate-200 p-3 text-sm leading-6"
              value={riskPreferences}
              onChange={(event) => setRiskPreferences(event.target.value)}
            />
            <span className="mt-2 block text-xs leading-5 text-slate-500">
              Comma-separated tags drive audit copy, empty-state guidance, and generated recommendation focus.
            </span>
          </label>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <CheckboxRow
            checked={privacyMode === "redact_pii"}
            onChange={(checked) => checked && setPrivacyMode("redact_pii")}
            label="PII redaction"
            detail="Detect likely email, card, phone, and token values before review."
          />
          <CheckboxRow
            checked={privacyMode === "short_retention"}
            onChange={(checked) => checked && setPrivacyMode("short_retention")}
            label="Short raw-data retention"
            detail="Private pilot target: 14 days for raw trace review, then derived artifacts remain."
          />
          <CheckboxRow
            checked={privacyMode === "derived_only"}
            onChange={(checked) => checked && setPrivacyMode("derived_only")}
            label="Store derived evals only"
            detail="Keep generated evals, graders, reports, and safe metadata instead of raw trace content where possible."
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            disabled={!project || busy === "settings"}
            onClick={() =>
              mutate("settings", () => {
                if (!project) throw new Error("Create a project before saving privacy settings.");
                return api(`/api/projects/${project.id}/settings`, {
                  method: "PATCH",
                  body: JSON.stringify({
                    privacyMode,
                    riskPreferences: riskPreferences
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  }),
                });
              }, project?.id)
            }
          >
            {busy === "settings" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save privacy settings
          </Button>
          <ReadOnlySetting label="Data residency" value="Deployment region policy" />
        </div>
      </Card>
      <Card className="mt-4 p-5">
        <h2 className="text-lg font-semibold text-slate-950">Retention Status</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {retentionStatusCopy(project?.privacyMode || "redact_pii")}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <RetentionMetric label="Earliest raw upload expiry" value={formatOptionalDate(earliestDate(state.uploadedFiles.map((file) => file.rawRetentionExpiresAt)))} />
          <RetentionMetric label="Earliest raw trace expiry" value={formatOptionalDate(earliestDate(state.traces.map((trace) => trace.rawRetentionExpiresAt)))} />
          <RetentionMetric label="Raw purge state" value={rawPurgeSummary(state)} />
        </div>
      </Card>
    </>
  );
}

function InventoryMetric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-[8px] border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function RetentionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function FullProjectExportButton({
  state,
  busy,
  mutate,
}: {
  state: WorkspaceState;
  busy: string | null;
  mutate: MutateFn;
}) {
  return state.activeProject ? (
    <Button
      variant="secondary"
      disabled={busy === "full-project-export"}
      onClick={() =>
        mutate("full-project-export", () =>
          api(`/api/projects/${state.activeProject?.id}/exports`, {
            method: "POST",
            body: JSON.stringify({ type: "full_project_json" }),
          }),
        )
      }
    >
      {busy === "full-project-export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
      Full project export
    </Button>
  ) : null;
}

function DeleteProjectButton({
  state,
  busy,
  mutate,
}: {
  state: WorkspaceState;
  busy: string | null;
  mutate: MutateFn;
}) {
  const [open, setOpen] = useState(false);
  const [confirmationName, setConfirmationName] = useState("");
  const project = state.activeProject;
  const matches = Boolean(project && confirmationName === project.name);

  if (!project) return null;

  return (
    <>
      <Button variant="danger" disabled={busy === "delete-project"} onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Delete project data
      </Button>
      {open ? (
        <div
          aria-labelledby="delete-project-title"
          aria-modal="true"
          role="dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4"
        >
          <div className="w-full max-w-lg rounded-[8px] border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="mt-1 rounded-[8px] bg-red-50 p-2 text-red-600">
                <Trash2 className="h-5 w-5" />
              </span>
              <div>
                <h2 id="delete-project-title" className="text-lg font-semibold text-slate-950">
                  Delete project data
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This queues an audited deletion for project records and associated storage objects. Type {project.name} to confirm.
                </p>
              </div>
            </div>
            <label className="mt-5 block">
              <span className="text-sm font-semibold text-slate-700">Confirmation project name</span>
              <input
                aria-label="Confirmation project name"
                className="mt-2 h-11 w-full rounded-[7px] border border-slate-200 px-3 text-sm"
                value={confirmationName}
                onChange={(event) => setConfirmationName(event.target.value)}
              />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setOpen(false);
                  setConfirmationName("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={!matches || busy === "delete-project"}
                onClick={() =>
                  mutate(
                    "delete-project",
                    () =>
                      api(`/api/projects/${project.id}`, {
                        method: "DELETE",
                        body: JSON.stringify({ confirmationName }),
                      }),
                    () => null,
                  ).then(() => {
                    setOpen(false);
                    setConfirmationName("");
                  })
                }
              >
                {busy === "delete-project" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SettingsHistoryCard({ state }: { state: WorkspaceState }) {
  const rows = useMemo(() => {
    const exportRows = state.exports.map((record) => ({
      id: `export-${record.id}`,
      kind: "Export",
      label: exportTypeLabel(record.type),
      status: record.status,
      timestamp: record.completedAt || record.createdAt,
      fileName: record.fileName,
      size: record.sizeBytes,
      downloadHref: record.status === "generated" ? `/api/exports/${record.id}/download` : "",
    }));
    const receiptRows = state.dataOperationReceipts.map((receipt) => ({
      id: `receipt-${receipt.id}`,
      kind: "Receipt",
      label: receiptLabel(receipt),
      status: receipt.status,
      timestamp: receipt.completedAt || receipt.createdAt,
      fileName: typeof receipt.metadata.fileName === "string" ? receipt.metadata.fileName : "",
      size: typeof receipt.metadata.sizeBytes === "number" ? receipt.metadata.sizeBytes : 0,
      downloadHref: `/api/receipts/${receipt.id}/download`,
    }));
    return [...exportRows, ...receiptRows].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [state.exports, state.dataOperationReceipts]);

  return (
    <Card className="mt-4 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 p-4">
        <History className="h-4 w-4 text-blue-600" />
        <h2 className="text-lg font-semibold text-slate-950">Export History / Receipts</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-950">{row.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{row.kind}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDate(row.timestamp)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {row.fileName ? (
                    <>
                      <span className="block font-medium text-slate-800">{row.fileName}</span>
                      <span className="text-xs text-slate-500">{row.size ? formatBytes(row.size) : "Size pending"}</span>
                    </>
                  ) : (
                    <span className="text-slate-400">Receipt only</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.downloadHref ? (
                    <a
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-[7px] border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      href={row.downloadHref}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Unavailable</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <div className="p-4"><EmptyText text="Exports and receipts appear after data operations." /></div> : null}
      </div>
    </Card>
  );
}

function ReadOnlySetting({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input
        readOnly
        value={value}
        className="mt-2 h-11 w-full rounded-[7px] border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700"
      />
      <span className="mt-2 block text-xs leading-5 text-slate-500">Fixed for the private MVP</span>
    </label>
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

function useDataInventory(state: WorkspaceState) {
  return useMemo(() => {
    const purgedUploads = state.uploadedFiles.filter((file) => file.rawPurgedAt || file.storageDeletedAt).length;
    const purgedTraces = state.traces.filter((trace) => trace.rawPurgedAt).length;
    const derivedArtifacts =
      state.evalCases.length +
      state.graders.length +
      state.evalRuns.length +
      state.evalResults.length +
      state.humanLabels.length +
      state.graderCalibrationRuns.length +
      state.graderCalibrationResults.length +
      state.failureClusters.length +
      state.promptVersions.length +
      state.promptCandidates.length +
      state.routingRules.length +
      state.cacheRecommendations.length +
      state.reports.length;
    const generatedExports = state.exports.filter((record) => record.status === "generated").length;

    return {
      rawUploads: state.uploadedFiles.length,
      retainedUploads: state.uploadedFiles.length - purgedUploads,
      purgedUploads,
      rawTraces: state.traces.length,
      retainedTraces: state.traces.length - purgedTraces,
      purgedTraces,
      derivedArtifacts,
      exports: state.exports.length,
      generatedExports,
      pendingExports: state.exports.length - generatedExports,
      auditRecords: state.auditEvents.length + state.dataOperationReceipts.length,
    };
  }, [state]);
}

function retentionStatusCopy(mode: string) {
  if (mode === "derived_only") {
    return "Derived-only mode keeps eval artifacts and safe metadata visible while raw trace content is minimized.";
  }
  if (mode === "short_retention") {
    return "Short-retention mode keeps raw uploads and traces only through their configured review window, then preserves derived audit artifacts.";
  }
  return "PII redaction mode keeps raw review data available with likely personal data redacted before eval and reporting work.";
}

function earliestDate(values: Array<string | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b))[0];
}

function formatOptionalDate(value?: string) {
  return value ? formatDate(value) : "Not scheduled";
}

function clampPercent(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

function rawPurgeSummary(state: WorkspaceState) {
  const rawItems = state.uploadedFiles.length + state.traces.length;
  const purgedItems =
    state.uploadedFiles.filter((file) => file.rawPurgedAt || file.storageDeletedAt).length +
    state.traces.filter((trace) => trace.rawPurgedAt).length;
  if (!rawItems) return "No raw records";
  if (purgedItems === rawItems) return "All raw records purged";
  if (purgedItems > 0) return `${purgedItems} of ${rawItems} raw records purged`;
  return "Raw records retained";
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

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <select
        aria-label={label}
        className="mt-2 h-11 w-full rounded-[7px] border border-slate-200 px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxRow({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  detail: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-[8px] border border-slate-200 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-blue-600"
      />
      <span>
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-slate-600">{detail}</span>
      </span>
    </label>
  );
}

function WarningRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          <p className="mt-1 text-sm leading-6 text-amber-800">{detail}</p>
        </div>
      </div>
    </div>
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
  mutate: MutateFn;
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

function PdfExportButton({
  state,
  busy,
  mutate,
}: {
  state: WorkspaceState;
  busy: string | null;
  mutate: MutateFn;
}) {
  return state.activeProject ? (
    <Button
      variant="secondary"
      disabled={busy === "export-pdf" || !state.reports.length}
      onClick={() =>
        mutate("export-pdf", async () => {
          const record = await api<{ id: string }>(`/api/projects/${state.activeProject?.id}/exports`, {
            method: "POST",
            body: JSON.stringify({ type: "audit_report_pdf" }),
          });
          window.location.href = `/api/exports/${record.id}/download`;
        })
      }
    >
      <Download className="h-4 w-4" />
      Export PDF
    </Button>
  ) : null;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB`;
  return `${Math.round(value / 1024 / 102.4) / 10} MB`;
}

function inferSourceLabel(fileName: string, contentType: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv") || contentType.includes("csv")) return "CSV";
  if (lower.endsWith(".ndjson") || lower.endsWith(".jsonl")) return "NDJSON";
  if (lower.endsWith(".json") || contentType.includes("json")) return "JSON";
  if (lower.endsWith(".txt") || contentType.startsWith("text/")) return "TXT";
  return "Unsupported";
}

function schemaPreview(source: string): Array<[string, string]> {
  if (source === "CSV") {
    return [["User input", "user_input"], ["Assistant output", "assistant_output"], ["Timestamp", "timestamp"]];
  }
  if (source === "JSON" || source === "NDJSON") {
    return [["User input", "prompt/input/messages"], ["Assistant output", "response/output/messages"], ["Metadata", "id/timestamp"]];
  }
  if (source === "TXT") {
    return [["User input", "User:/Prompt block"], ["Assistant output", "Assistant:/Output block"], ["Metadata", "file block"]];
  }
  return [["User input", "pending"], ["Assistant output", "pending"], ["Metadata", "pending"]];
}

function privacyModeLabel(mode: string) {
  if (mode === "derived_only") return "Derived only";
  if (mode === "short_retention") return "Short retention";
  return "Redact likely PII";
}

function exportTypeLabel(type: WorkspaceState["exports"][number]["type"]) {
  if (type === "audit_report_pdf") return "Audit report PDF";
  if (type === "full_project_json") return "Full project JSON";
  if (type === "issues_csv") return "Issues CSV";
  if (type === "audit_report_csv") return "Audit report CSV";
  return "Eval pack CSV";
}

function receiptLabel(receipt: WorkspaceState["dataOperationReceipts"][number]) {
  if (receipt.operation === "full_project_export") return "Full project export receipt";
  if (receipt.operation === "project_delete") return "Project deletion receipt";
  if (receipt.operation === "raw_trace_purge") return "Raw trace purge receipt";
  return "Export download receipt";
}

function statusTone(status: string): Tone {
  if (status === "failed") return "red";
  if (status === "generated" || status === "completed") return "green";
  if (status === "running") return "blue";
  return "slate";
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormDataBody =
    init?.body instanceof FormData ||
    Object.prototype.toString.call(init?.body) === "[object FormData]";
  const headers = isFormDataBody || init?.body === undefined ? undefined : { "content-type": "application/json" };
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
