"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileText,
  GitCompareArrows,
  History,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Target,
  Trash2,
  Wand2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clampQualityBarInput, normalizeQualityBarInput } from "@/lib/evaller/draft-validation";
import { buildReadinessReport } from "@/lib/evaller/readiness-report";
import type {
  EvallerReadinessReportRecord,
  EvallerReviewComment,
  EvallerRunDetail,
  EvallerRunSummary,
  EvallerWorkspace,
  EvallerWorkspaceInput,
} from "@/lib/evaller/types";
import { cn } from "@/lib/utils";

type View = "workspace" | "runs" | "templates" | "settings";
type BusyState = "loading" | "saving" | "running" | "applying" | null;
type AutoSaveState = "saved" | "unsaved" | "saving" | "failed";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    issues?: Array<{ message: string }>;
  };
};

const SUPPORT_TEMPLATE: EvallerWorkspaceInput = {
  name: "Support AI quality test",
  description: "Check whether a support AI can handle billing, privacy, and urgent account issues before release.",
  instructions: [
    "You are a support AI for a B2B SaaS product.",
    "Be concise, accurate, and warm.",
    "Acknowledge user frustration or urgency before solving.",
    "Offer a human handoff for billing, privacy, deletion, escalation, or urgent demo-blocking issues.",
    "State policy boundaries clearly and avoid promising unsupported actions.",
    "Ask one clarifying question when the safest next step depends on missing account details.",
  ].join("\n"),
  qualityBar: 85,
  scenarios: [
    {
      title: "Frustrated billing issue",
      message: "I have been charged twice and nobody has fixed it. This is really frustrating.",
      expectedBehavior: "Acknowledge frustration, explain the billing path, and offer a human handoff.",
    },
    {
      title: "Privacy deletion request",
      message: "Delete all of my account data and confirm it is gone today.",
      expectedBehavior: "Handle privacy carefully without claiming deletion has completed.",
    },
    {
      title: "Urgent setup blocker",
      message: "I cannot finish setup and I need this working before a customer demo tomorrow.",
      expectedBehavior: "Ask a clarifying question, give a practical next step, and offer escalation.",
    },
  ],
  successCriteria: [
    { text: "Acknowledges user frustration or urgency" },
    { text: "Gives a safe and accurate support answer" },
    { text: "Offers a human handoff for billing, privacy, or urgent issues" },
    { text: "Does not promise unsupported account, billing, or deletion actions" },
  ],
};

export function EvallerApp({ view }: { view: View }) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<EvallerWorkspace | null>(null);
  const [draft, setDraft] = useState<EvallerWorkspaceInput | null>(null);
  const [qualityBarInput, setQualityBarInput] = useState(String(SUPPORT_TEMPLATE.qualityBar));
  const [selectedRun, setSelectedRun] = useState<EvallerRunDetail | null>(null);
  const [busy, setBusy] = useState<BusyState>("loading");
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>("saved");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lastSavedDraftRef = useRef("");
  const currentDraftRef = useRef("");
  const autoSaveTimerRef = useRef<number | null>(null);
  const qualityBarIssue = useMemo(() => normalizeQualityBarInput(qualityBarInput).issue, [qualityBarInput]);

  const loadWorkspace = useCallback(async () => {
    setBusy((current) => current || "loading");
    setError("");
    try {
      const payload = await api<EvallerWorkspace>("/api/evaller/workspace");
      const input = workspaceToInput(payload);
      setWorkspace(payload);
      setDraft(input);
      setQualityBarInput(String(input.qualityBar));
      setSelectedRun(payload.latestRun || null);
      lastSavedDraftRef.current = serializeDraft(input);
      setAutoSaveState("saved");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Workspace could not be loaded.");
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadWorkspace(), 0);
    const refresh = () => loadWorkspace();
    window.addEventListener("evaller:refresh", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("evaller:refresh", refresh);
    };
  }, [loadWorkspace]);

  async function saveDraft(nextDraft = draft, options: { quiet?: boolean } = {}) {
    if (!nextDraft) return null;
    const requestKey = serializeDraft(nextDraft);
    setBusy("saving");
    setAutoSaveState("saving");
    setError("");
    if (!options.quiet) setMessage("");
    try {
      const saved = await api<EvallerWorkspace>("/api/evaller/workspace", {
        method: "PUT",
        body: JSON.stringify(nextDraft),
      });
      const input = workspaceToInput(saved);
      if (options.quiet && currentDraftRef.current && currentDraftRef.current !== requestKey) {
        setWorkspace(saved);
        lastSavedDraftRef.current = requestKey;
        setAutoSaveState("unsaved");
        return saved;
      }
      setWorkspace(saved);
      setDraft(input);
      setQualityBarInput(String(input.qualityBar));
      lastSavedDraftRef.current = serializeDraft(input);
      setAutoSaveState("saved");
      if (!options.quiet) setMessage("Workspace saved.");
      return saved;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Workspace could not be saved.");
      setAutoSaveState("failed");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function runTest() {
    if (!draft) return;
    const clientIssues = [...validateDraft(draft), ...(qualityBarIssue ? [qualityBarIssue] : [])];
    if (clientIssues.length) {
      setError(clientIssues.join(" "));
      return;
    }

    setBusy("running");
    setError("");
    setMessage("");
    try {
      const run = await api<EvallerRunDetail>("/api/evals/run", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      await loadWorkspace();
      setSelectedRun(run);
      setMessage("AI test run completed.");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "AI test run failed.");
    } finally {
      setBusy(null);
    }
  }

  async function applyFix(runId: string, suggestionId: string) {
    setBusy("applying");
    setError("");
    setMessage("");
    try {
      const saved = await api<EvallerWorkspace>(`/api/evals/run/${runId}/apply-fix`, {
        method: "POST",
        body: JSON.stringify({ suggestionId }),
      });
      setWorkspace(saved);
      setDraft(workspaceToInput(saved));
      setSelectedRun(saved.latestRun || selectedRun);
      setMessage("Prompt fix applied. Run again to compare the next result.");
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Prompt fix could not be applied.");
    } finally {
      setBusy(null);
    }
  }

  async function openRun(runId: string) {
    setBusy("loading");
    setError("");
    try {
      const run = await api<EvallerRunDetail>(`/api/evals/run?runId=${encodeURIComponent(runId)}`);
      setSelectedRun(run);
      setMessage("");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Run could not be loaded.");
    } finally {
      setBusy(null);
    }
  }

  async function addReviewComment(runId: string, body: string) {
    setBusy("saving");
    setError("");
    try {
      const comment = await api<EvallerReviewComment>(`/api/evals/run/${runId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setSelectedRun((current) => current && current.id === runId
        ? { ...current, comments: [comment, ...current.comments] }
        : current);
      setMessage("Review comment added.");
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "Review comment could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function updateReportApproval(runId: string, status: "approved" | "changes_requested", note?: string) {
    setBusy("saving");
    setError("");
    try {
      const report = await api<EvallerReadinessReportRecord>(`/api/evals/run/${runId}/readiness-report/approve`, {
        method: "POST",
        body: JSON.stringify({ status, note }),
      });
      updateSelectedRunReport(runId, report);
      setMessage(status === "approved" ? "Readiness report approved." : "Changes requested for this release.");
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Readiness report could not be updated.");
    } finally {
      setBusy(null);
    }
  }

  async function trackReportCopy(runId: string) {
    const report = await api<EvallerReadinessReportRecord>(`/api/evals/run/${runId}/readiness-report/copy`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    updateSelectedRunReport(runId, report);
    return report;
  }

  async function restorePromptVersion(promptVersionId: string) {
    setBusy("saving");
    setError("");
    try {
      const saved = await api<EvallerWorkspace>(`/api/evals/prompt-versions/${promptVersionId}/restore`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const input = workspaceToInput(saved);
      setWorkspace(saved);
      setDraft(input);
      setQualityBarInput(String(input.qualityBar));
      lastSavedDraftRef.current = serializeDraft(input);
      setAutoSaveState("saved");
      setSelectedRun(saved.latestRun || selectedRun);
      setMessage("Prompt version restored as a new active version.");
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Prompt version could not be restored.");
    } finally {
      setBusy(null);
    }
  }

  async function inviteReviewer(email: string, role: "admin" | "member" | "reviewer") {
    setBusy("saving");
    setError("");
    try {
      await api<{ invitation: unknown; acceptUrl: string; token: string }>("/api/organizations/invitations", {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
      await loadWorkspace();
      setMessage("Team invitation created.");
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Team invitation could not be created.");
    } finally {
      setBusy(null);
    }
  }

  function updateSelectedRunReport(runId: string, report: EvallerReadinessReportRecord) {
    setSelectedRun((current) => current && current.id === runId ? { ...current, readinessReport: report } : current);
    setWorkspace((current) => {
      if (!current?.latestRun || current.latestRun.id !== runId) return current;
      return { ...current, latestRun: { ...current.latestRun, readinessReport: report } };
    });
  }

  useEffect(() => {
    if (!draft) return;
    const serialized = serializeDraft(draft);
    currentDraftRef.current = serialized;
    if (serialized === lastSavedDraftRef.current) {
      setAutoSaveState((current) => current === "saving" ? current : "saved");
      return;
    }
    setAutoSaveState("unsaved");
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      void saveDraft(draft, { quiet: true });
    }, 800);
    return () => {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    };
    // Autosave is intentionally keyed to the serialized draft snapshot only.
    // saveDraft receives that snapshot directly, so including it as a dependency would reschedule saves unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  useEffect(() => {
    const shouldWarn = autoSaveState === "unsaved" || autoSaveState === "saving" || autoSaveState === "failed";
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldWarn) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [autoSaveState]);

  if (busy === "loading" && !workspace) {
    return (
      <main className="min-h-[calc(100vh-80px)] px-4 py-8 lg:px-8">
        <div className="flex min-h-[360px] items-center justify-center rounded-[8px] border border-slate-200 bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="ml-3 text-sm font-medium text-slate-600">Loading Evaller workspace...</span>
        </div>
      </main>
    );
  }

  if (!workspace || !draft) {
    return (
      <main className="min-h-[calc(100vh-80px)] px-4 py-8 lg:px-8">
        <LoadRecovery message={error || "Workspace unavailable."} onRefresh={loadWorkspace} busy={busy} />
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-80px)] bg-slate-50 px-4 py-6 text-slate-950 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <PageHeader view={view} />
        {message ? <StatusMessage kind="success" message={message} /> : null}
        {error ? <StatusMessage kind="error" message={error} /> : null}
        {view === "workspace" ? (
          <WorkspaceView
            draft={draft}
            setDraft={setDraft}
            workspace={workspace}
            selectedRun={selectedRun}
            busy={busy}
            autoSaveState={autoSaveState}
            qualityBarInput={qualityBarInput}
            qualityBarIssue={qualityBarIssue}
            setQualityBarInput={setQualityBarInput}
            onSave={() => saveDraft()}
            onRun={runTest}
            onApplyFix={applyFix}
            onCopyReport={trackReportCopy}
            onAddComment={addReviewComment}
            onUpdateApproval={updateReportApproval}
          />
        ) : view === "runs" ? (
          <RunsView
            workspace={workspace}
            runs={workspace.runs}
            selectedRun={selectedRun}
            busy={busy}
            onOpenRun={openRun}
            onRunAgain={runTest}
            onApplyFix={applyFix}
            onCopyReport={trackReportCopy}
            onAddComment={addReviewComment}
            onUpdateApproval={updateReportApproval}
          />
        ) : view === "templates" ? (
          <TemplatesView
            busy={busy}
            onApply={async () => {
              const saved = await saveDraft(SUPPORT_TEMPLATE);
              if (saved) {
                router.push("/workspace");
              }
            }}
          />
        ) : (
          <SettingsView workspace={workspace} busy={busy} onRestorePromptVersion={restorePromptVersion} onInviteReviewer={inviteReviewer} />
        )}
      </div>
    </main>
  );
}

function PageHeader({ view }: { view: View }) {
  const copy = {
    workspace: {
      title: "Workspace",
      detail: "Define the support AI behavior, run realistic scenarios, and improve the prompt before release.",
    },
    runs: {
      title: "Runs",
      detail: "Track previous AI test runs and compare whether prompt changes improved quality.",
    },
    templates: {
      title: "Templates",
      detail: "Start from support AI testing patterns, then make them specific to your product.",
    },
    settings: {
      title: "Settings",
      detail: "Workspace basics, privacy posture, and server-side AI execution details.",
    },
  }[view];

  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Evaller</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{copy.detail}</p>
      </div>
    </div>
  );
}

function WorkspaceView({
  draft,
  setDraft,
  workspace,
  selectedRun,
  busy,
  autoSaveState,
  qualityBarInput,
  qualityBarIssue,
  setQualityBarInput,
  onSave,
  onRun,
  onApplyFix,
  onCopyReport,
  onAddComment,
  onUpdateApproval,
}: {
  draft: EvallerWorkspaceInput;
  setDraft: (draft: EvallerWorkspaceInput) => void;
  workspace: EvallerWorkspace;
  selectedRun: EvallerRunDetail | null;
  busy: BusyState;
  autoSaveState: AutoSaveState;
  qualityBarInput: string;
  qualityBarIssue: string;
  setQualityBarInput: (value: string) => void;
  onSave: () => void;
  onRun: () => void;
  onApplyFix: (runId: string, suggestionId: string) => void;
  onCopyReport: (runId: string) => Promise<EvallerReadinessReportRecord>;
  onAddComment: (runId: string, body: string) => void;
  onUpdateApproval: (runId: string, status: "approved" | "changes_requested", note?: string) => void;
}) {
  const clientIssues = [...validateDraft(draft), ...(qualityBarIssue ? [qualityBarIssue] : [])];
  const latestRun = selectedRun || workspace.latestRun;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
      <section className="space-y-5">
        <Panel
          title="AI Feature"
          detail="Keep this plain-language. It should sound like what a product or support lead would say."
          icon={Target}
        >
          <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
            <Label text="AI test name">
              <input
                className="input"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Support AI quality test"
              />
            </Label>
            <Label text="What are you testing?">
              <input
                className="input"
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="Whether our support AI handles billing, privacy, and urgent setup issues."
              />
            </Label>
          </div>
        </Panel>

        <Panel title="AI Instructions" detail="This is the prompt Evaller will test." icon={ClipboardList}>
          <textarea
            aria-label="AI instructions"
            className="min-h-56 w-full resize-y rounded-[8px] border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            value={draft.instructions}
            onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
          />
        </Panel>

        <Panel title="User Scenarios" detail="Use realistic user messages, not test jargon." icon={Sparkles}>
          <div className="space-y-3">
            {draft.scenarios.map((scenario, index) => (
              <div key={scenario.id || index} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <input
                    aria-label={`Scenario ${index + 1} title`}
                    className="input"
                    value={scenario.title}
                    onChange={(event) => updateScenario(draft, setDraft, index, { title: event.target.value })}
                    placeholder={`User scenario ${index + 1}`}
                  />
                  <button
                    aria-label={`Delete scenario ${index + 1}`}
                    className="icon-button"
                    onClick={() => setDraft({ ...draft, scenarios: draft.scenarios.filter((_, itemIndex) => itemIndex !== index) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  aria-label={`Scenario ${index + 1} message`}
                  className="mt-3 min-h-24 w-full resize-y rounded-[8px] border border-slate-200 bg-white p-3 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={scenario.message}
                  onChange={(event) => updateScenario(draft, setDraft, index, { message: event.target.value })}
                  placeholder="Write the user message Evaller should test."
                />
                <input
                  aria-label={`Scenario ${index + 1} expected behavior`}
                  className="input mt-3"
                  value={scenario.expectedBehavior || ""}
                  onChange={(event) => updateScenario(draft, setDraft, index, { expectedBehavior: event.target.value })}
                  placeholder="Expected behavior, optional"
                />
              </div>
            ))}
            <button
              className="secondary-button"
              onClick={() =>
                setDraft({
                  ...draft,
                  scenarios: [
                    ...draft.scenarios,
                    { title: `User scenario ${draft.scenarios.length + 1}`, message: "", expectedBehavior: "" },
                  ],
                })
              }
            >
              <Plus className="h-4 w-4" /> Add user scenario
            </button>
          </div>
        </Panel>

        <Panel title="Success Criteria" detail="Evaller checks every response against these criteria." icon={CheckCircle2}>
          <div className="space-y-3">
            {draft.successCriteria.map((criterion, index) => (
              <div key={criterion.id || index} className="flex items-center gap-3">
                <input
                  aria-label={`Success criterion ${index + 1}`}
                  className="input"
                  value={criterion.text}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      successCriteria: draft.successCriteria.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, text: event.target.value } : item,
                      ),
                    })
                  }
                  placeholder="What does a good answer need to do?"
                />
                <button
                  aria-label={`Delete success criterion ${index + 1}`}
                  className="icon-button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      successCriteria: draft.successCriteria.filter((_, itemIndex) => itemIndex !== index),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              className="secondary-button"
              onClick={() =>
                setDraft({
                  ...draft,
                  successCriteria: [...draft.successCriteria, { text: "" }],
                })
              }
            >
              <Plus className="h-4 w-4" /> Add success criterion
            </button>
          </div>
        </Panel>
      </section>

      <aside className="space-y-5">
        <Panel title="Quality Bar" detail="A scenario passes only when its score meets this bar." icon={Target}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <input
              aria-label="Quality bar"
              type="range"
              min={50}
              max={100}
              value={draft.qualityBar}
              onChange={(event) => {
                const value = Number(event.target.value);
                setQualityBarInput(String(value));
                setDraft({ ...draft, qualityBar: value });
              }}
              className="w-full accent-blue-600"
            />
            <input
              aria-label="Quality bar value"
              type="number"
              min={50}
              max={100}
              className={cn(
                "h-11 w-full rounded-[8px] border text-center text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-24",
                qualityBarIssue ? "border-red-300 bg-red-50 text-red-900" : "border-slate-200",
              )}
              value={qualityBarInput}
              aria-invalid={Boolean(qualityBarIssue)}
              aria-describedby={qualityBarIssue ? "quality-bar-error" : undefined}
              onChange={(event) => {
                const nextInput = event.target.value;
                setQualityBarInput(nextInput);
                const parsed = normalizeQualityBarInput(nextInput);
                if (!parsed.issue && parsed.value !== null) {
                  setDraft({ ...draft, qualityBar: parsed.value });
                }
              }}
              onBlur={() => {
                const clamped = clampQualityBarInput(qualityBarInput);
                setQualityBarInput(String(clamped));
                setDraft({ ...draft, qualityBar: clamped });
              }}
            />
          </div>
          {qualityBarIssue ? <p id="quality-bar-error" className="mt-2 text-sm font-medium text-red-700">{qualityBarIssue}</p> : null}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button className="secondary-button" disabled={busy !== null} onClick={onSave}>
              <Save className="h-4 w-4" /> Save
            </button>
            <button
              className="primary-button"
              disabled={busy !== null || clientIssues.length > 0}
              aria-describedby={clientIssues.length ? "run-validation-message" : undefined}
              onClick={onRun}
            >
              {busy === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Run AI Test
            </button>
            <AutoSaveBadge state={autoSaveState} />
          </div>
          {clientIssues.length ? (
            <div id="run-validation-message" className="mt-4 rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
              {clientIssues.join(" ")}
            </div>
          ) : null}
        </Panel>

        {latestRun ? (
          <ResultsPanel
            run={latestRun}
            busy={busy}
            context={latestRun.id === workspace.latestRun?.id ? "workspace" : "historical"}
            canApprove={workspace.membershipRole === "owner" || workspace.membershipRole === "admin"}
            onRunAgain={onRun}
            onApplyFix={onApplyFix}
            onCopyReport={onCopyReport}
            onAddComment={onAddComment}
            onUpdateApproval={onUpdateApproval}
          />
        ) : (
          <Panel title="Results" detail="Run an AI test to see scenario scores, failures, and fixes." icon={History}>
            <div className="rounded-[8px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
              No AI test has been run yet. The first result will show failed scenarios and prompt fixes here.
            </div>
          </Panel>
        )}
      </aside>
    </div>
  );
}

function ResultsPanel({
  run,
  busy,
  context,
  canApprove,
  onRunAgain,
  onApplyFix,
  onCopyReport,
  onAddComment,
  onUpdateApproval,
}: {
  run: EvallerRunDetail;
  busy: BusyState;
  context: "workspace" | "latest" | "historical";
  canApprove: boolean;
  onRunAgain: () => void;
  onApplyFix: (runId: string, suggestionId: string) => void;
  onCopyReport: (runId: string) => Promise<EvallerReadinessReportRecord>;
  onAddComment: (runId: string, body: string) => void;
  onUpdateApproval: (runId: string, status: "approved" | "changes_requested", note?: string) => void;
}) {
  const delta = run.previousRun ? Math.round((run.passRate - run.previousRun.passRate) * 10) / 10 : null;
  const report = readinessReportForRun(run);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [commentBody, setCommentBody] = useState("");
  const [approvalNote, setApprovalNote] = useState("");

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report.copyText);
      await onCopyReport(run.id);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <Panel title={context === "workspace" ? "Latest Result" : "Selected Run"} detail="Review failures, apply a fix, then run again." icon={History}>
      <div className="mb-4 rounded-[8px] border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={context === "historical" ? "slate" : "blue"}>{context === "historical" ? "Historical" : "Latest"}</StatusBadge>
              <StatusBadge tone={report.approvalStatus === "approved" ? "green" : report.approvalStatus === "changes_requested" ? "amber" : "slate"}>
                {approvalLabel(report.approvalStatus)}
              </StatusBadge>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-950">{run.promptVersionLabel}</p>
            <p className="mt-1 text-xs text-slate-500">{new Date(run.startedAt).toLocaleString()}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs font-medium text-slate-500">Viewed run</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{run.passRate}% pass · {run.failedScenarios} failed</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric label="Pass rate" value={`${run.passRate}%`} tone={run.failedScenarios ? "warn" : "good"} />
        <Metric label="Average score" value={`${run.averageScore}`} />
        <Metric label="Failed" value={`${run.failedScenarios}/${run.totalScenarios}`} tone={run.failedScenarios ? "bad" : "good"} />
      </div>
      {delta !== null ? (
        <div className={cn("mt-3 rounded-[8px] p-3 text-sm font-semibold", delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
          {delta >= 0 ? "+" : ""}
          {delta}% pass-rate change from the previous run.
        </div>
      ) : null}

      <div className="mt-5 rounded-[8px] border border-blue-100 bg-blue-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-white text-blue-700 ring-1 ring-blue-100">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-blue-950">AI Release Readiness Report</h3>
              <p className="mt-1 text-sm font-semibold text-blue-800">{report.status}</p>
              <p className="mt-2 text-sm leading-6 text-blue-900">{report.summary}</p>
            </div>
          </div>
          <button className="primary-button shrink-0" onClick={copyReport}>
            <Copy className="h-4 w-4" />
            {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy report"}
          </button>
        </div>
        {copyState === "copied" ? (
          <div className="mt-3 rounded-[8px] border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            Report copied. Copy count: {report.copyCount + 1}.
          </div>
        ) : null}
        <dl className="mt-4 grid gap-3 text-sm">
          <ReadOnly label="Applied prompt" value={report.appliedPromptChange} />
          <ReadOnly label="Next step" value={report.recommendedNextStep} />
        </dl>
        <div className="mt-4 rounded-[8px] bg-white p-3 text-sm leading-6 text-slate-700">
          <p className="font-semibold text-slate-950">Remaining risks</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {report.remainingRisks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 rounded-[8px] border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Release review</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Comments and approvals stay attached to this exact run and prompt version.
            </p>
          </div>
          <StatusBadge tone={report.approvalStatus === "approved" ? "green" : report.approvalStatus === "changes_requested" ? "amber" : "slate"}>
            {approvalLabel(report.approvalStatus)}
          </StatusBadge>
        </div>
        <textarea
          aria-label="Review comment"
          className="mt-4 min-h-20 w-full rounded-[8px] border border-slate-200 p-3 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          value={commentBody}
          onChange={(event) => setCommentBody(event.target.value)}
          placeholder="Add a release review note for the team."
        />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            className="secondary-button"
            disabled={busy !== null || !commentBody.trim()}
            onClick={() => {
              onAddComment(run.id, commentBody);
              setCommentBody("");
            }}
          >
            <MessageSquare className="h-4 w-4" />
            Add comment
          </button>
          <input
            aria-label="Approval note"
            className="input sm:max-w-[280px]"
            value={approvalNote}
            onChange={(event) => setApprovalNote(event.target.value)}
            placeholder="Optional approval note"
          />
          <button
            className="primary-button"
            disabled={busy !== null || !canApprove}
            onClick={() => onUpdateApproval(run.id, "approved", approvalNote)}
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve
          </button>
          <button
            className="secondary-button"
            disabled={busy !== null || !canApprove}
            onClick={() => onUpdateApproval(run.id, "changes_requested", approvalNote)}
          >
            <AlertTriangle className="h-4 w-4" />
            Request changes
          </button>
        </div>
        {!canApprove ? (
          <p className="mt-2 text-xs leading-5 text-slate-500">Only owners and admins can approve release readiness reports.</p>
        ) : null}
        <div className="mt-4 space-y-2">
          {run.comments.length ? run.comments.map((comment) => (
            <div key={comment.id} className="rounded-[8px] bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <strong className="text-slate-800">{comment.actorUserId}</strong>
                <span>{new Date(comment.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1">{comment.body}</p>
            </div>
          )) : (
            <p className="rounded-[8px] border border-dashed border-slate-300 p-3 text-sm text-slate-600">No review comments yet.</p>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {run.results.map((result) => (
          <div key={result.id} className="rounded-[8px] border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">{result.scenarioTitle}</h3>
                <p className="mt-1 text-xs text-slate-500">{result.score}/100</p>
              </div>
              <StatusPill status={result.status} />
            </div>
            <p className="mt-3 rounded-[8px] bg-slate-50 p-3 text-sm leading-6 text-slate-700">{result.assistantResponse}</p>
            {result.failedCriteria.length ? (
              <div className="mt-3 text-sm text-red-700">
                <strong>Missed:</strong> {result.failedCriteria.join("; ")}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {run.failurePatterns.length ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-950">Failure patterns</h3>
          <div className="mt-3 space-y-2">
            {run.failurePatterns.map((pattern) => (
              <div key={pattern.id} className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                <strong>{pattern.title}</strong>
                <p>{pattern.description}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {run.promptSuggestions.length ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-950">Suggested prompt fixes</h3>
          <div className="mt-3 space-y-3">
            {run.promptSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="rounded-[8px] border border-blue-100 bg-blue-50 p-4">
                <h4 className="text-sm font-semibold text-blue-950">{suggestion.title}</h4>
                <p className="mt-2 text-sm leading-6 text-blue-900">{suggestion.explanation}</p>
                <pre className="mt-3 whitespace-pre-wrap rounded-[8px] bg-white p-3 text-xs leading-5 text-slate-700">{suggestion.patch}</pre>
                <button
                  className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-[7px] bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy !== null || Boolean(suggestion.appliedAt)}
                  onClick={() => onApplyFix(run.id, suggestion.id)}
                >
                  <Wand2 className="h-4 w-4" />
                  {suggestion.appliedAt ? "Applied" : "Apply fix"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <button className="primary-button mt-5 w-full" disabled={busy !== null} onClick={onRunAgain}>
        {busy === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Run Again
      </button>
    </Panel>
  );
}

function RunsView({
  workspace,
  runs,
  selectedRun,
  busy,
  onOpenRun,
  onRunAgain,
  onApplyFix,
  onCopyReport,
  onAddComment,
  onUpdateApproval,
}: {
  workspace: EvallerWorkspace;
  runs: EvallerRunSummary[];
  selectedRun: EvallerRunDetail | null;
  busy: BusyState;
  onOpenRun: (runId: string) => void;
  onRunAgain: () => void;
  onApplyFix: (runId: string, suggestionId: string) => void;
  onCopyReport: (runId: string) => Promise<EvallerReadinessReportRecord>;
  onAddComment: (runId: string, body: string) => void;
  onUpdateApproval: (runId: string, status: "approved" | "changes_requested", note?: string) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Panel title="Run History" detail="Every AI test run stays linked to the prompt version used." icon={History}>
        <div className="space-y-3">
          {runs.length ? runs.map((run) => (
            <button
              key={run.id}
              className={cn(
                "w-full rounded-[8px] border p-4 text-left transition",
                selectedRun?.id === run.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50",
              )}
              onClick={() => onOpenRun(run.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-950">{run.passRate}% pass</span>
                <span className="text-xs text-slate-500">{new Date(run.startedAt).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{run.promptVersionLabel}</p>
              <p className="mt-1 text-xs text-slate-500">{run.failedScenarios} failed of {run.totalScenarios}</p>
              {selectedRun?.id === run.id ? <p className="mt-2 text-xs font-semibold text-blue-700">Viewing this run</p> : null}
            </button>
          )) : (
            <div className="rounded-[8px] border border-dashed border-slate-300 p-5 text-sm text-slate-600">
              No runs yet. Start from Workspace.
            </div>
          )}
        </div>
      </Panel>
      {selectedRun ? (
        <ResultsPanel
          run={selectedRun}
          busy={busy}
          context={selectedRun.id === workspace.latestRun?.id ? "latest" : "historical"}
          canApprove={workspace.membershipRole === "owner" || workspace.membershipRole === "admin"}
          onRunAgain={onRunAgain}
          onApplyFix={onApplyFix}
          onCopyReport={onCopyReport}
          onAddComment={onAddComment}
          onUpdateApproval={onUpdateApproval}
        />
      ) : (
        <Panel title="Result Detail" detail="Select a run to inspect scenario results." icon={ClipboardList}>
          <div className="rounded-[8px] border border-dashed border-slate-300 p-8 text-sm text-slate-600">No run selected.</div>
        </Panel>
      )}
    </div>
  );
}

function TemplatesView({ busy, onApply }: { busy: BusyState; onApply: () => void }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Support AI Release Check" detail="A focused starter test for customer-facing support assistants." icon={Sparkles}>
        <div className="space-y-3 text-sm leading-6 text-slate-700">
          <p>Includes billing, privacy, and urgent setup scenarios with a quality bar of 85.</p>
          <p>Use this when you need to prove the support prompt is safe enough to ship.</p>
        </div>
        <button className="primary-button mt-5" disabled={busy !== null} onClick={onApply}>
          <ArrowRight className="h-4 w-4" /> Use template
        </button>
      </Panel>
      <Panel title="More Templates Later" detail="Evaller is intentionally narrow for this release." icon={Target}>
        <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          RAG, product copilot, and tool-use templates stay out of the first release until the support AI loop is reliable.
        </div>
      </Panel>
    </div>
  );
}

function SettingsView({
  workspace,
  busy,
  onRestorePromptVersion,
  onInviteReviewer,
}: {
  workspace: EvallerWorkspace;
  busy: BusyState;
  onRestorePromptVersion: (promptVersionId: string) => void;
  onInviteReviewer: (email: string, role: "admin" | "member" | "reviewer") => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Workspace" detail="Current saved AI test." icon={Target}>
          <dl className="grid gap-3 text-sm">
            <ReadOnly label="AI test" value={workspace.aiTest.name} />
            <ReadOnly label="Active prompt" value={workspace.activePrompt.label} />
            <ReadOnly label="User scenarios" value={String(workspace.scenarios.length)} />
            <ReadOnly label="Success criteria" value={String(workspace.successCriteria.length)} />
            <ReadOnly label="Quality bar" value={`${workspace.aiTest.qualityBar}/100`} />
          </dl>
        </Panel>
        <TeamReviewPanel workspace={workspace} busy={busy} onInviteReviewer={onInviteReviewer} />
      </div>
      <PromptVersionsPanel workspace={workspace} busy={busy} onRestorePromptVersion={onRestorePromptVersion} />
      <Panel title="AI + Privacy" detail="Customer API keys are never entered in the UI." icon={Sparkles}>
        <div className="space-y-3 text-sm leading-6 text-slate-700">
          <ReadOnly label="OpenAI credentials" value="Server-side only" />
          <ReadOnly label="Customer API key entry" value="Not available" />
          <ReadOnly label="Run storage" value="Saved to the authenticated workspace" />
          <ReadOnly label="Current release" value="Support AI prompt simulation" />
          <div className="rounded-[8px] border border-blue-100 bg-blue-50 p-3 text-blue-900">
            Evaller stores prompts, scenarios, run results, readiness reports, comments, approvals, and prompt versions so teams can track improvement over time.
          </div>
        </div>
      </Panel>
    </div>
  );
}

function TeamReviewPanel({
  workspace,
  busy,
  onInviteReviewer,
}: {
  workspace: EvallerWorkspace;
  busy: BusyState;
  onInviteReviewer: (email: string, role: "admin" | "member" | "reviewer") => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "reviewer">("reviewer");

  return (
    <Panel title="Team Review" detail="Invite teammates and keep approvals tied to workspace roles." icon={MessageSquare}>
      <div className="grid gap-3 text-sm">
        <ReadOnly label="Your role" value={workspace.membershipRole} />
        <ReadOnly label="Members" value={String(workspace.members.length)} />
        <ReadOnly label="Pending invites" value={String(workspace.invitations.filter((invite) => invite.status === "pending").length)} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
        <input
          aria-label="Invite email"
          className="input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@example.com"
        />
        <select
          aria-label="Invite role"
          className="input"
          value={role}
          onChange={(event) => setRole(event.target.value as "admin" | "member" | "reviewer")}
        >
          <option value="reviewer">Reviewer</option>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button
          className="secondary-button"
          disabled={busy !== null || !email.trim()}
          onClick={() => {
            onInviteReviewer(email, role);
            setEmail("");
          }}
        >
          Invite
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {workspace.members.map((member) => (
          <div key={member.id} className="flex flex-col gap-1 rounded-[8px] bg-slate-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium text-slate-800">{member.userId}</span>
            <StatusBadge tone={member.role === "owner" || member.role === "admin" ? "blue" : "slate"}>{member.role}</StatusBadge>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PromptVersionsPanel({
  workspace,
  busy,
  onRestorePromptVersion,
}: {
  workspace: EvallerWorkspace;
  busy: BusyState;
  onRestorePromptVersion: (promptVersionId: string) => void;
}) {
  const comparisonVersions = workspace.promptVersions.filter((prompt) => prompt.id !== workspace.activePrompt.id);
  const [selectedPromptId, setSelectedPromptId] = useState(comparisonVersions[0]?.id || workspace.activePrompt.id);
  const selectedPrompt = workspace.promptVersions.find((prompt) => prompt.id === selectedPromptId) || comparisonVersions[0] || workspace.activePrompt;
  const diff = diffPromptLines(workspace.activePrompt.instructions, selectedPrompt.instructions);

  return (
    <Panel title="Prompt Versions" detail="Compare the active prompt against previous versions and restore without rewriting history." icon={GitCompareArrows}>
      <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {workspace.promptVersions.map((prompt) => (
            <button
              key={prompt.id}
              className={cn(
                "w-full rounded-[8px] border p-3 text-left text-sm transition",
                prompt.id === selectedPrompt.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50",
              )}
              onClick={() => setSelectedPromptId(prompt.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-950">{prompt.label}</span>
                {prompt.id === workspace.activePrompt.id ? <StatusBadge tone="green">Active</StatusBadge> : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">{new Date(prompt.createdAt).toLocaleString()}</p>
            </button>
          ))}
        </div>
        <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Compare with {selectedPrompt.label}</h3>
              <p className="mt-1 text-xs text-slate-500">Green lines are active-prompt additions; red lines only exist in the selected version.</p>
            </div>
            <button
              className="secondary-button"
              disabled={busy !== null || selectedPrompt.id === workspace.activePrompt.id}
              onClick={() => onRestorePromptVersion(selectedPrompt.id)}
            >
              <RefreshCw className="h-4 w-4" />
              Restore as new active version
            </button>
          </div>
          <div className="mt-4 grid gap-2 text-xs leading-5">
            {diff.length ? diff.map((line) => (
              <div
                key={`${line.kind}-${line.text}`}
                className={cn(
                  "rounded-[7px] px-3 py-2 font-mono",
                  line.kind === "added" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800",
                )}
              >
                {line.kind === "added" ? "+ " : "- "}
                {line.text}
              </div>
            )) : (
              <p className="rounded-[8px] border border-dashed border-slate-300 p-3 text-sm text-slate-600">No line-level differences for this selection.</p>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Panel({
  title,
  detail,
  icon: Icon,
  children,
}: {
  title: string;
  detail: string;
  icon: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-blue-50 text-blue-700 ring-1 ring-blue-100">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{text}</span>
      {children}
    </label>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  return (
    <div className={cn(
      "rounded-[8px] border p-3",
      tone === "good" ? "border-emerald-200 bg-emerald-50" : tone === "warn" ? "border-amber-200 bg-amber-50" : tone === "bad" ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50",
    )}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: "passed" | "failed" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
      status === "passed" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
    )}>
      {status === "passed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {status === "passed" ? "Passed" : "Failed"}
    </span>
  );
}

function StatusMessage({ kind, message }: { kind: "success" | "error"; message: string }) {
  return (
    <div className={cn(
      "mb-4 flex items-start gap-3 rounded-[8px] border p-3 text-sm leading-6",
      kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800",
    )}>
      {kind === "success" ? <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

function LoadRecovery({ message, onRefresh, busy }: { message: string; onRefresh: () => void; busy: BusyState }) {
  return (
    <div className="mx-auto flex min-h-[360px] max-w-2xl flex-col justify-center rounded-[8px] border border-red-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-red-50 text-red-700">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Workspace did not load</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Try refreshing. If this keeps happening, share the time and account with support so the server request can be traced.
          </p>
        </div>
      </div>
      <button className="primary-button mt-5 w-fit" disabled={busy === "loading"} onClick={onRefresh}>
        {busy === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Refresh
      </button>
    </div>
  );
}

function AutoSaveBadge({ state }: { state: AutoSaveState }) {
  const copy = {
    saved: ["Saved", "green"],
    unsaved: ["Unsaved", "amber"],
    saving: ["Saving", "blue"],
    failed: ["Save failed", "red"],
  } as const;
  const [label, tone] = copy[state];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

function StatusBadge({ tone, children }: { tone: "blue" | "green" | "amber" | "red" | "slate"; children: React.ReactNode }) {
  return (
    <span className={cn(
      "inline-flex min-h-7 items-center justify-center rounded-full px-2.5 text-xs font-semibold",
      tone === "blue" ? "bg-blue-50 text-blue-700" :
        tone === "green" ? "bg-emerald-50 text-emerald-700" :
          tone === "amber" ? "bg-amber-50 text-amber-800" :
            tone === "red" ? "bg-red-50 text-red-700" :
              "bg-slate-100 text-slate-700",
    )}>
      {children}
    </span>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="break-words font-semibold text-slate-900 sm:text-right">{value}</dd>
    </div>
  );
}

function workspaceToInput(workspace: EvallerWorkspace): EvallerWorkspaceInput {
  return {
    name: workspace.aiTest.name,
    description: workspace.aiTest.description,
    instructions: workspace.activePrompt.instructions,
    qualityBar: workspace.aiTest.qualityBar,
    scenarios: workspace.scenarios.map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      message: scenario.message,
      expectedBehavior: scenario.expectedBehavior,
    })),
    successCriteria: workspace.successCriteria.map((criterion) => ({
      id: criterion.id,
      text: criterion.text,
    })),
  };
}

function updateScenario(
  draft: EvallerWorkspaceInput,
  setDraft: (draft: EvallerWorkspaceInput) => void,
  index: number,
  patch: Partial<EvallerWorkspaceInput["scenarios"][number]>,
) {
  setDraft({
    ...draft,
    scenarios: draft.scenarios.map((scenario, itemIndex) =>
      itemIndex === index ? { ...scenario, ...patch } : scenario,
    ),
  });
}

function validateDraft(draft: EvallerWorkspaceInput) {
  const issues: string[] = [];
  if (!draft.instructions.trim()) issues.push("Add AI instructions before running.");
  if (!draft.scenarios.length) issues.push("Add at least one user scenario.");
  if (draft.scenarios.some((scenario) => !scenario.message.trim())) issues.push("Complete or delete empty user scenarios.");
  if (!draft.successCriteria.length) issues.push("Add at least one success criterion.");
  if (draft.successCriteria.some((criterion) => !criterion.text.trim())) issues.push("Complete or delete empty success criteria.");
  if (!Number.isInteger(draft.qualityBar) || draft.qualityBar < 50 || draft.qualityBar > 100) issues.push("Set the quality bar between 50 and 100.");
  return issues;
}

function readinessReportForRun(run: EvallerRunDetail): EvallerReadinessReportRecord {
  if (run.readinessReport) return run.readinessReport;
  const report = buildReadinessReport(run);
  return {
    id: `derived_${run.id}`,
    organizationId: run.organizationId,
    aiTestId: run.aiTestId,
    runId: run.id,
    status: report.status,
    approvalStatus: "pending",
    summary: report.summary,
    beforePassRate: run.previousRun?.passRate,
    afterPassRate: run.passRate,
    appliedPromptChange: report.appliedPromptChange,
    remainingRisks: report.remainingRisks,
    recommendedNextStep: report.recommendedNextStep,
    copyText: report.copyText,
    copyCount: 0,
    createdAt: run.completedAt || run.startedAt,
    updatedAt: run.completedAt || run.startedAt,
  };
}

function approvalLabel(status: EvallerReadinessReportRecord["approvalStatus"]) {
  if (status === "approved") return "Approved";
  if (status === "changes_requested") return "Changes requested";
  return "Pending review";
}

function diffPromptLines(active: string, selected: string) {
  const activeLines = uniqueLines(active);
  const selectedLines = uniqueLines(selected);
  const added = activeLines
    .filter((line) => !selectedLines.includes(line))
    .map((text) => ({ kind: "added" as const, text }));
  const removed = selectedLines
    .filter((line) => !activeLines.includes(line))
    .map((text) => ({ kind: "removed" as const, text }));
  return [...added, ...removed];
}

function uniqueLines(value: string) {
  return Array.from(new Set(value.split("\n").map((line) => line.trim()).filter(Boolean)));
}

function serializeDraft(draft: EvallerWorkspaceInput) {
  return JSON.stringify(draft);
}

async function api<T>(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The workspace request timed out. Refresh to try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.ok) {
    const issueMessage = payload.error?.issues?.map((issue) => issue.message).join(" ");
    throw new Error(issueMessage || payload.error?.message || "Request failed.");
  }
  return payload.data;
}
