"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Copy,
  FileText,
  Gauge,
  GitCompareArrows,
  History,
  ListChecks,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trash2,
  Users,
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
type StatusTone = "blue" | "green" | "amber" | "red" | "slate" | "violet";
type MetricTone = "neutral" | "good" | "warn" | "bad";
type NextAction = {
  title: string;
  detail: string;
  tone: "blue" | "green" | "amber" | "red" | "violet";
  icon: typeof Sparkles;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    correlationId?: string;
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
    const currentQualityIssue = nextDraft === draft ? qualityBarIssue : undefined;
    const validationIssues = [...validateDraft(nextDraft), ...(currentQualityIssue ? [currentQualityIssue] : [])];
    if (validationIssues.length) {
      if (!options.quiet) {
        setError(validationIssues.join(" "));
        setMessage("");
      }
      setAutoSaveState("unsaved");
      return null;
    }
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
      const message = runError instanceof Error ? runError.message : "AI test run failed.";
      await loadWorkspace().catch(() => undefined);
      setError(message);
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
      const input = workspaceToInput(saved);
      setWorkspace(saved);
      setDraft(input);
      setQualityBarInput(String(input.qualityBar));
      lastSavedDraftRef.current = serializeDraft(input);
      setAutoSaveState("saved");
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
        <PageHeader view={view} workspace={workspace} />
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
                setMessage("Template applied. Workspace setup updated.");
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

function PageHeader({ view, workspace }: { view: View; workspace: EvallerWorkspace }) {
  const copy = {
    workspace: {
      title: "Workspace Cockpit",
      detail: "Define the support AI behavior, run realistic scenarios, and decide what is ready for release.",
    },
    runs: {
      title: "Runs History",
      detail: "Track previous AI test runs, prompt versions, and whether quality improved over time.",
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
    <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="blue">Evaller</StatusBadge>
          <StatusBadge tone="slate">{workspace.activePrompt.label}</StatusBadge>
          <StatusBadge tone="slate">{workspace.membershipRole}</StatusBadge>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{copy.detail}</p>
      </div>
      <div className="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm md:min-w-[260px]">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Current workspace</p>
        <p className="mt-1 truncate font-semibold text-slate-950">{workspace.aiTest.name}</p>
        <p className="mt-1 text-xs text-slate-500">{workspace.scenarios.length} scenarios · {workspace.successCriteria.length} criteria</p>
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
  const report = latestRun ? readinessReportForRun(latestRun) : null;
  const nextAction = getNextAction(draft, latestRun, clientIssues);

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <ReadinessSummary
          draft={draft}
          run={latestRun}
          report={report}
          autoSaveState={autoSaveState}
        />
        <NextActionCard action={nextAction} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Quality bar"
          value={`${draft.qualityBar}/100`}
          detail="Minimum scenario score"
          tone="neutral"
        />
        <Metric
          label="Scenarios"
          value={String(draft.scenarios.length)}
          detail="User messages in scope"
          tone={draft.scenarios.length ? "neutral" : "warn"}
        />
        <Metric
          label="Criteria"
          value={String(draft.successCriteria.length)}
          detail="Checks per response"
          tone={draft.successCriteria.length ? "neutral" : "warn"}
        />
        <Metric
          label="Autosave"
          value={autoSaveLabel(autoSaveState)}
          detail="Draft persistence"
          tone={autoSaveState === "failed" ? "bad" : autoSaveState === "saved" ? "good" : "warn"}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
        <section className="space-y-5">
        <Panel
          title="AI Feature"
          detail="Use plain product language so reviewers understand the release decision quickly."
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

        <Panel title="AI Instructions" detail="This active prompt is what every scenario will be tested against." icon={ClipboardList}>
          <textarea
            aria-label="AI instructions"
            aria-invalid={!draft.instructions.trim()}
            aria-describedby={!draft.instructions.trim() ? "ai-instructions-error" : undefined}
            className={cn(
              "min-h-64 w-full resize-y rounded-[8px] border bg-white p-4 font-mono text-sm leading-6 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
              !draft.instructions.trim() ? "border-red-300 bg-red-50/40" : "border-slate-200",
            )}
            value={draft.instructions}
            onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
          />
          <FieldError id="ai-instructions-error" message="AI instructions are required before saving or running." show={!draft.instructions.trim()} />
        </Panel>

        <Panel title="User Scenarios" detail="Keep scenarios close to the conversations your support AI will actually see." icon={Sparkles}>
          <div className="space-y-3">
            {draft.scenarios.map((scenario, index) => (
              <div key={scenario.id || index} className="rounded-[8px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-[7px] bg-white px-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    S{index + 1}
                  </span>
                  <button
                    aria-label={`Delete scenario ${index + 1}`}
                    className="icon-button h-9 w-9"
                    onClick={() => setDraft({ ...draft, scenarios: draft.scenarios.filter((_, itemIndex) => itemIndex !== index) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3">
                  <input
                    aria-label={`Scenario ${index + 1} title`}
                    className="input"
                    value={scenario.title}
                    onChange={(event) => updateScenario(draft, setDraft, index, { title: event.target.value })}
                    placeholder={`User scenario ${index + 1}`}
                  />
                  <textarea
                    aria-label={`Scenario ${index + 1} message`}
                    aria-invalid={!scenario.message.trim()}
                    aria-describedby={!scenario.message.trim() ? `scenario-${index + 1}-message-error` : undefined}
                    className={cn(
                      "min-h-24 w-full resize-y rounded-[8px] border bg-white p-3 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
                      !scenario.message.trim() ? "border-red-300 bg-red-50/40" : "border-slate-200",
                    )}
                    value={scenario.message}
                    onChange={(event) => updateScenario(draft, setDraft, index, { message: event.target.value })}
                    placeholder="Write the user message Evaller should test."
                  />
                  <FieldError
                    id={`scenario-${index + 1}-message-error`}
                    message="Scenario message is required before saving or running."
                    show={!scenario.message.trim()}
                  />
                  <input
                    aria-label={`Scenario ${index + 1} expected behavior`}
                    className="input"
                    value={scenario.expectedBehavior || ""}
                    onChange={(event) => updateScenario(draft, setDraft, index, { expectedBehavior: event.target.value })}
                    placeholder="Expected behavior, optional"
                  />
                </div>
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

        <Panel title="Success Criteria" detail="These are the explicit checks behind the release readiness score." icon={CheckCircle2}>
          <div className="space-y-3">
            {draft.successCriteria.map((criterion, index) => (
              <div key={criterion.id || index} className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <input
                    aria-label={`Success criterion ${index + 1}`}
                    aria-invalid={!criterion.text.trim()}
                    aria-describedby={!criterion.text.trim() ? `criterion-${index + 1}-error` : undefined}
                    className={cn("input", !criterion.text.trim() ? "border-red-300 bg-red-50/40" : "")}
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
                  <FieldError
                    id={`criterion-${index + 1}-error`}
                    message="Success criterion is required before saving or running."
                    show={!criterion.text.trim()}
                  />
                </div>
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
        <Panel title="Quality Bar" detail="A scenario passes only when its score meets this bar." icon={Gauge}>
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
            <button
              className="secondary-button"
              disabled={busy !== null || clientIssues.length > 0}
              aria-describedby={clientIssues.length ? "run-validation-message" : undefined}
              onClick={onSave}
            >
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
    </div>
  );
}

function ReadinessSummary({
  draft,
  run,
  report,
  autoSaveState,
}: {
  draft: EvallerWorkspaceInput;
  run: EvallerRunDetail | null | undefined;
  report: EvallerReadinessReportRecord | null;
  autoSaveState: AutoSaveState;
}) {
  const tone = run ? readinessTone(run, report) : "slate";
  const score = run?.status === "completed" ? `${run.passRate}` : "--";
  const progress = run?.status === "completed" ? run.passRate : 0;
  const status = run
    ? run.status === "failed"
      ? "Run failed"
      : run.status === "running"
        ? "Running"
        : report?.approvalStatus === "approved"
          ? "Approved for release"
          : report?.approvalStatus === "changes_requested"
            ? "Changes requested"
            : run.failedScenarios
              ? "Review needed"
              : "Ready for review"
    : "Not run yet";

  return (
    <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[260px_1fr]">
        <div className={cn(
          "border-b border-slate-200 p-5 lg:border-b-0 lg:border-r",
          tone === "green" ? "bg-emerald-50/70" :
            tone === "amber" ? "bg-amber-50/70" :
              tone === "red" ? "bg-red-50/70" :
                "bg-slate-50",
        )}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Release readiness</p>
            <StatusBadge tone={tone}>{status}</StatusBadge>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-6xl font-semibold leading-none tracking-normal text-slate-950">{score}</span>
            <span className="mb-1 text-sm font-semibold text-slate-500">/100</span>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/80 ring-1 ring-slate-200">
            <div
              className={cn(
                "h-full rounded-full",
                tone === "green" ? "bg-emerald-500" :
                  tone === "amber" ? "bg-amber-500" :
                    tone === "red" ? "bg-red-500" :
                      "bg-slate-300",
              )}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{draft.name || "Untitled AI test"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{draft.description || "Describe what this AI release check should prove."}</p>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <ReadinessFact label="Quality bar" value={`${draft.qualityBar}/100`} icon={Gauge} />
            <ReadinessFact label="Scenarios" value={String(draft.scenarios.length)} icon={ListChecks} />
            <ReadinessFact label="Criteria" value={String(draft.successCriteria.length)} icon={CheckCircle2} />
            <ReadinessFact label="Draft" value={autoSaveLabel(autoSaveState)} icon={Clock3} />
          </dl>
        </div>
      </div>
    </section>
  );
}

function ReadinessFact({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Sparkles;
}) {
  return (
    <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function NextActionCard({ action }: { action: ReturnType<typeof getNextAction> }) {
  return (
    <section className={cn(
      "rounded-[8px] border p-5 shadow-sm",
      action.tone === "red" ? "border-red-200 bg-red-50" :
        action.tone === "amber" ? "border-amber-200 bg-amber-50" :
          action.tone === "green" ? "border-emerald-200 bg-emerald-50" :
            action.tone === "violet" ? "border-violet-100 bg-violet-50" :
              "border-blue-100 bg-blue-50",
    )}>
      <div className="flex items-start gap-3">
        <span className={cn(
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-white ring-1",
          action.tone === "red" ? "text-red-700 ring-red-100" :
            action.tone === "amber" ? "text-amber-700 ring-amber-100" :
              action.tone === "green" ? "text-emerald-700 ring-emerald-100" :
                action.tone === "violet" ? "text-violet-700 ring-violet-100" :
                  "text-blue-700 ring-blue-100",
        )}>
          <action.icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Next recommended action</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">{action.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">{action.detail}</p>
        </div>
      </div>
    </section>
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
  const [manualCopyText, setManualCopyText] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [approvalNote, setApprovalNote] = useState("");

  async function copyReport() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.copyText);
      setManualCopyText("");
      setCopyState("copied");
      void onCopyReport(run.id).catch(() => undefined);
    } catch {
      setManualCopyText(report.copyText);
      setCopyState("failed");
    }
  }

  if (run.status !== "completed" || !report) {
    const isRunning = run.status === "running";
    return (
      <Panel
        title={context === "workspace" ? "Latest Result" : "Selected Run"}
        detail="This run did not produce eval results or a release readiness report."
        icon={AlertTriangle}
      >
        <div className="rounded-[8px] border border-red-200 bg-red-50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-white text-red-700 ring-1 ring-red-100">
                {isRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : <AlertTriangle className="h-5 w-5" />}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={isRunning ? "amber" : "red"}>{isRunning ? "Run in progress" : "Run failed"}</StatusBadge>
                  <StatusBadge tone="slate">{run.promptVersionLabel}</StatusBadge>
                </div>
                <h3 className="mt-3 text-base font-semibold text-red-950">
                  {isRunning ? "Evaller is still running this AI test." : "Evaller could not complete this AI test."}
                </h3>
                <p className="mt-2 text-sm leading-6 text-red-900">
                  {run.errorMessage || (isRunning
                    ? "Refresh in a moment to check for the completed result."
                    : "Try again. If it fails again, share the reference in the error message with support.")}
                </p>
              </div>
            </div>
            <button className="secondary-button shrink-0" disabled={busy !== null} onClick={onRunAgain}>
              {busy === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Retry Run
            </button>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <ReadOnly label="Prompt version" value={run.promptVersionLabel} />
          <ReadOnly label="Started" value={new Date(run.startedAt).toLocaleString()} />
          <ReadOnly label="Scenarios queued" value={String(run.totalScenarios)} />
          <ReadOnly label="Readiness report" value="Unavailable until a run completes" />
        </dl>
        <div className="mt-4 rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          No scenario scores, prompt suggestions, report copy, or approval actions are shown for failed system runs. This protects the release decision from stale or misleading results.
        </div>
      </Panel>
    );
  }

  return (
    <Panel title={context === "workspace" ? "Latest Result" : "Selected Run"} detail="Review failures, approve release readiness, or apply the next prompt fix." icon={History}>
      <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
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
          <button className="secondary-button shrink-0" disabled={busy !== null} onClick={onRunAgain}>
            {busy === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Run Again
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Pass rate" value={`${run.passRate}%`} detail="Scenario pass rate" tone={run.failedScenarios ? "warn" : "good"} />
        <Metric label="Average score" value={`${run.averageScore}`} detail="Mean response quality" />
        <Metric label="Failed" value={`${run.failedScenarios}/${run.totalScenarios}`} detail="Needs review" tone={run.failedScenarios ? "bad" : "good"} />
        <Metric
          label="Delta"
          value={delta === null ? "New" : `${delta >= 0 ? "+" : ""}${delta}%`}
          detail="Compared with prior run"
          tone={delta === null ? "neutral" : delta >= 0 ? "good" : "bad"}
        />
      </div>
      {delta !== null ? (
        <div className="mt-3 rounded-[8px] border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-blue-900">
          {delta >= 0 ? "+" : ""}{delta}% pass-rate change from the previous run.
        </div>
      ) : null}

      <div className="mt-5 rounded-[8px] border border-blue-100 bg-blue-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-white text-blue-700 ring-1 ring-blue-100">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-blue-950">AI Release Readiness Report</h3>
                <StatusBadge tone={readinessTone(run, report)}>{report.status}</StatusBadge>
              </div>
              <p className="mt-2 text-sm leading-6 text-blue-950">{report.summary}</p>
            </div>
          </div>
          <button className="primary-button shrink-0" onClick={copyReport}>
            <Copy className="h-4 w-4" />
            {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy report"}
          </button>
        </div>
        {copyState === "copied" ? (
          <div className="mt-4 rounded-[8px] border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            Report copied.
          </div>
        ) : null}
        {copyState === "failed" ? (
          <div className="mt-4 rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            <p className="font-semibold">Clipboard access was blocked.</p>
            <p>Select the report text below to copy it manually.</p>
            <textarea
              readOnly
              className="mt-3 min-h-44 w-full rounded-[8px] border border-amber-200 bg-white p-3 font-mono text-xs leading-5 text-slate-800"
              value={manualCopyText}
            />
          </div>
        ) : null}
        <dl className="mt-4 grid gap-3 text-sm">
          <ReadOnly label="Before/after pass rate" value={formatReportPassRate(report)} />
          <ReadOnly label="Applied prompt" value={report.appliedPromptChange} />
          <ReadOnly label="Next step" value={report.recommendedNextStep} />
        </dl>
        <div className="mt-4 rounded-[8px] bg-white p-4 text-sm leading-6 text-slate-700 ring-1 ring-blue-100">
          <p className="font-semibold text-slate-950">Remaining risks</p>
          <ul className="mt-2 space-y-2">
            {report.remainingRisks.map((risk) => (
              <li key={risk} className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>{risk}</span>
              </li>
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
        <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto_auto_auto]">
          <input
            aria-label="Approval note"
            className="input"
            value={approvalNote}
            onChange={(event) => setApprovalNote(event.target.value)}
            placeholder="Optional approval note"
          />
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

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-950">Scenario results</h3>
          <StatusBadge tone={run.failedScenarios ? "amber" : "green"}>{run.failedScenarios ? `${run.failedScenarios} need review` : "All passed"}</StatusBadge>
        </div>
        <div className="mt-3 space-y-3">
          {run.results.map((result) => (
            <div
              key={result.id}
              className={cn(
                "rounded-[8px] border bg-white p-4",
                result.status === "failed" ? "border-red-200" : "border-slate-200",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-950">{result.scenarioTitle}</h4>
                  <p className="mt-1 text-xs text-slate-500">{result.score}/100 · {result.passedCriteria.length} criteria passed</p>
                </div>
                <StatusPill status={result.status} />
              </div>
              <p className="mt-3 rounded-[8px] bg-slate-50 p-3 text-sm leading-6 text-slate-700">{result.assistantResponse}</p>
              {result.failedCriteria.length ? (
                <div className="mt-3 rounded-[8px] bg-red-50 p-3 text-sm leading-6 text-red-800">
                  <strong>Missed:</strong> {result.failedCriteria.join("; ")}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {run.failurePatterns.length ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-950">Failure patterns</h3>
          <div className="mt-3 space-y-2">
            {run.failurePatterns.map((pattern) => (
              <div key={pattern.id} className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{pattern.title}</strong>
                  <StatusBadge tone={pattern.severity === "high" ? "red" : pattern.severity === "medium" ? "amber" : "slate"}>{pattern.severity}</StatusBadge>
                </div>
                <p className="mt-1">{pattern.description}</p>
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
              <div key={suggestion.id} className="rounded-[8px] border border-violet-100 bg-violet-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <StatusBadge tone="violet">AI-generated draft</StatusBadge>
                    <h4 className="mt-2 text-sm font-semibold text-violet-950">{suggestion.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-violet-950">{suggestion.explanation}</p>
                  </div>
                  <button
                    className="primary-button shrink-0"
                    disabled={busy !== null || Boolean(suggestion.appliedAt)}
                    onClick={() => onApplyFix(run.id, suggestion.id)}
                  >
                    <Wand2 className="h-4 w-4" />
                    {suggestion.appliedAt ? "Applied" : "Apply fix"}
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-[8px] bg-white p-3 text-xs leading-5 text-slate-700 ring-1 ring-violet-100">{suggestion.patch}</pre>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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
  const trendRuns = [...runs].slice(0, 8).reverse();

  return (
    <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
      <section className="space-y-5">
        <Panel title="Run History" detail="Every AI test run stays linked to the prompt version used." icon={History}>
          <div className="space-y-3">
            {runs.length ? runs.map((run) => {
              const selected = selectedRun?.id === run.id;
              const systemFailure = run.status !== "completed";
              return (
                <button
                  key={run.id}
                  className={cn(
                    "w-full rounded-[8px] border p-4 text-left transition",
                    selected ? "border-blue-300 bg-blue-50 shadow-sm ring-2 ring-blue-100" : "border-slate-200 bg-white hover:bg-slate-50",
                  )}
                  onClick={() => onOpenRun(run.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-slate-950">
                          {systemFailure ? "Run failed" : `${run.passRate}% pass`}
                        </span>
                        <StatusBadge tone={systemFailure ? "red" : run.failedScenarios ? "amber" : "green"}>
                          {systemFailure ? "System failure" : run.failedScenarios ? `${run.failedScenarios} failed` : "Clean"}
                        </StatusBadge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{run.promptVersionLabel}</p>
                      {systemFailure && run.errorMessage ? (
                        <p className="mt-2 text-xs leading-5 text-red-700">{run.errorMessage}</p>
                      ) : null}
                    </div>
                    {selected ? <StatusBadge tone="blue">Viewing this run</StatusBadge> : null}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>{new Date(run.startedAt).toLocaleString()}</span>
                    <span>{run.totalScenarios} scenarios</span>
                  </div>
                </button>
              );
            }) : (
              <EmptyState
                title="No runs yet"
                detail="Start from Workspace to create the first release-readiness run."
              />
            )}
          </div>
        </Panel>

        <Panel title="Pass-rate Trend" detail="A lightweight view of whether prompt changes are improving quality." icon={TrendingUp}>
          {trendRuns.length ? (
            <div className="space-y-4">
              <div className="flex h-36 items-end gap-2 rounded-[8px] border border-slate-200 bg-slate-50 p-3">
                {trendRuns.map((run) => (
                  <div key={run.id} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div
                      className={cn(
                        "w-full rounded-t-[6px]",
                        run.status !== "completed" ? "bg-red-400" : run.failedScenarios ? "bg-amber-400" : "bg-emerald-500",
                      )}
                      style={{ height: `${run.status !== "completed" ? 8 : Math.max(8, Math.min(100, run.passRate))}%` }}
                      title={run.status !== "completed" ? "Run failed" : `${run.passRate}% pass`}
                    />
                    <span className="text-[10px] font-semibold text-slate-500">{run.status !== "completed" ? "Fail" : `${run.passRate}%`}</span>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric
                  label="Latest"
                  value={runs[0] ? runs[0].status !== "completed" ? "Run failed" : `${runs[0].passRate}%` : "--"}
                  detail="Most recent run"
                  tone={runs[0]?.status !== "completed" ? "bad" : runs[0]?.failedScenarios ? "warn" : "good"}
                />
                <Metric label="Runs" value={String(runs.length)} detail="Stored history" />
              </div>
            </div>
          ) : (
            <EmptyState title="Trend will appear after runs" detail="Evaller will chart pass rates as prompt versions are tested." />
          )}
        </Panel>
      </section>

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
          <EmptyState title="No run selected" detail="Choose a run from the history list to inspect its scenario results and release report." />
        </Panel>
      )}
    </div>
  );
}

function TemplatesView({ busy, onApply }: { busy: BusyState; onApply: () => void }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Panel title="Support AI Release Check" detail="A focused starter workspace for customer-facing support assistants." icon={Sparkles}>
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="rounded-[8px] border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-normal text-blue-700">Recommended starter</p>
              <h2 className="mt-2 text-xl font-semibold text-blue-950">{SUPPORT_TEMPLATE.name}</h2>
              <p className="mt-2 text-sm leading-6 text-blue-950">{SUPPORT_TEMPLATE.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Quality bar" value={`${SUPPORT_TEMPLATE.qualityBar}`} detail="Default threshold" />
              <Metric label="Scenarios" value={String(SUPPORT_TEMPLATE.scenarios.length)} detail="Billing, privacy, urgency" />
              <Metric label="Criteria" value={String(SUPPORT_TEMPLATE.successCriteria.length)} detail="Release checks" />
            </div>
            <button className="primary-button" disabled={busy !== null} onClick={onApply}>
              <ArrowRight className="h-4 w-4" /> Use template
            </button>
          </div>
          <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">Included scenarios</p>
            <div className="mt-3 space-y-2">
              {SUPPORT_TEMPLATE.scenarios.map((scenario) => (
                <div key={scenario.title} className="rounded-[8px] bg-white p-3 text-sm ring-1 ring-slate-200">
                  <p className="font-semibold text-slate-900">{scenario.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{scenario.expectedBehavior}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>
      <Panel title="Template Roadmap" detail="Evaller stays narrow until the support release loop is excellent." icon={Target}>
        <div className="space-y-3">
          {["RAG answer quality", "Tool-use agent safety", "Product copilot readiness"].map((item) => (
            <div key={item} className="flex items-center justify-between gap-3 rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-sm">
              <span className="font-medium text-slate-800">{item}</span>
              <StatusBadge tone="slate">Later</StatusBadge>
            </div>
          ))}
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
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <Panel title="Workspace Control" detail="Current saved AI release check and its review surface." icon={Target}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Quality bar" value={`${workspace.aiTest.qualityBar}`} detail="Minimum score" />
            <Metric label="Scenarios" value={String(workspace.scenarios.length)} detail="User tests" />
            <Metric label="Criteria" value={String(workspace.successCriteria.length)} detail="Checks" />
            <Metric label="Prompt" value={`v${workspace.activePrompt.version}`} detail={workspace.activePrompt.label} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm">
            <ReadOnly label="AI test" value={workspace.aiTest.name} />
            <ReadOnly label="Description" value={workspace.aiTest.description} />
          </dl>
        </Panel>
        <TeamReviewPanel workspace={workspace} busy={busy} onInviteReviewer={onInviteReviewer} />
      </div>
      <PromptVersionsPanel workspace={workspace} busy={busy} onRestorePromptVersion={onRestorePromptVersion} />
      <Panel title="AI + Privacy" detail="Trust posture for the focused Evaller release loop." icon={ShieldCheck}>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <dl className="grid gap-3 text-sm">
            <ReadOnly label="OpenAI credentials" value="Server-side only" />
            <ReadOnly label="Customer API key entry" value="Not available" />
            <ReadOnly label="Run storage" value="Authenticated workspace" />
            <ReadOnly label="Current release" value="Support AI prompt simulation" />
          </dl>
          <div className="rounded-[8px] border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Review data is retained with context
            </div>
            <p className="mt-2">
              Evaller stores prompts, scenarios, run results, readiness reports, comments, approvals, and prompt versions so teams can track improvement over time.
            </p>
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
    <Panel title="Team Review" detail="Invite teammates and keep approvals tied to workspace roles." icon={Users}>
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
    <section className="rounded-[8px] border border-slate-200/90 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
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

function FieldError({ id, message, show }: { id: string; message: string; show: boolean }) {
  if (!show) return null;
  return <p id={id} className="mt-2 text-sm font-medium text-red-700">{message}</p>;
}

function Metric({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: MetricTone;
}) {
  return (
    <div className={cn(
      "rounded-[8px] border p-3",
      tone === "good" ? "border-emerald-200 bg-emerald-50" : tone === "warn" ? "border-amber-200 bg-amber-50" : tone === "bad" ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50",
    )}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words text-xl font-semibold text-slate-950">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p> : null}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1">{detail}</p>
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

function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <span className={cn(
      "inline-flex min-h-7 items-center justify-center rounded-full px-2.5 text-xs font-semibold",
      tone === "blue" ? "bg-blue-50 text-blue-700" :
        tone === "green" ? "bg-emerald-50 text-emerald-700" :
          tone === "amber" ? "bg-amber-50 text-amber-800" :
            tone === "red" ? "bg-red-50 text-red-700" :
              tone === "violet" ? "bg-violet-50 text-violet-700" :
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

function autoSaveLabel(state: AutoSaveState) {
  if (state === "saved") return "Saved";
  if (state === "saving") return "Saving";
  if (state === "failed") return "Save failed";
  return "Unsaved";
}

function readinessTone(
  run: EvallerRunDetail,
  report?: EvallerReadinessReportRecord | null,
): StatusTone {
  if (run.status === "failed") return "red";
  if (run.status === "running") return "amber";
  if (report?.approvalStatus === "approved") return "green";
  if (report?.approvalStatus === "changes_requested") return "amber";
  if (report?.status === "Not ready" || run.passRate < 60) return "red";
  if (run.failedScenarios > 0 || run.passRate < run.qualityBar) return "amber";
  return "green";
}

function getNextAction(
  draft: EvallerWorkspaceInput,
  run: EvallerRunDetail | null | undefined,
  clientIssues: string[],
): NextAction {
  if (clientIssues.length) {
    return {
      title: "Complete setup before running",
      detail: clientIssues[0],
      tone: "amber",
      icon: AlertTriangle,
    };
  }

  if (!run) {
    return {
      title: "Run the first AI test",
      detail: `Evaller will score ${draft.scenarios.length} scenarios against ${draft.successCriteria.length} criteria and create the first release report.`,
      tone: "blue",
      icon: Sparkles,
    };
  }

  if (run.status !== "completed") {
    return {
      title: run.status === "running" ? "Refresh when the run finishes" : "Retry the AI test",
      detail: run.errorMessage || "This was a system run failure, so Evaller did not create scenario scores or a readiness report.",
      tone: run.status === "running" ? "amber" : "red",
      icon: RefreshCw,
    };
  }

  const report = readinessReportForRun(run);
  const unappliedSuggestion = run.promptSuggestions.find((suggestion) => !suggestion.appliedAt);
  const failurePattern = run.failurePatterns[0];

  if (run.passRate < 60) {
    return {
      title: "Stabilize the release before approval",
      detail: failurePattern?.description || "The latest run has severe quality risk. Review failed scenarios before approving this prompt.",
      tone: "red",
      icon: AlertTriangle,
    };
  }

  if (unappliedSuggestion) {
    return {
      title: "Review suggested prompt fix",
      detail: unappliedSuggestion.explanation,
      tone: "violet",
      icon: Wand2,
    };
  }

  if (failurePattern) {
    return {
      title: failurePattern.title,
      detail: failurePattern.description,
      tone: failurePattern.severity === "high" ? "red" : "amber",
      icon: AlertTriangle,
    };
  }

  if (report?.approvalStatus === "pending") {
    return {
      title: "Approve or request changes",
      detail: "The latest run is ready for human release review. Add a note so the decision is tied to this prompt version.",
      tone: "blue",
      icon: ShieldCheck,
    };
  }

  if (report?.approvalStatus === "changes_requested") {
    return {
      title: "Resolve requested changes",
      detail: report.approvalNote || report.recommendedNextStep,
      tone: "amber",
      icon: AlertTriangle,
    };
  }

  return {
    title: "Keep monitoring release quality",
    detail: "This run is approved. Re-run after prompt edits or scenario changes to keep readiness evidence current.",
    tone: "green",
    icon: CheckCircle2,
  };
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

function readinessReportForRun(run: EvallerRunDetail): EvallerReadinessReportRecord | null {
  if (run.status !== "completed") return null;
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

function formatReportPassRate(report: EvallerReadinessReportRecord) {
  if (typeof report.beforePassRate === "number") {
    const delta = Math.round((report.afterPassRate - report.beforePassRate) * 10) / 10;
    return `${report.beforePassRate}% before, ${report.afterPassRate}% after (${delta >= 0 ? "+" : ""}${delta}%).`;
  }
  return `${report.afterPassRate}% baseline.`;
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
    throw new Error("Network connection failed. Check your connection, then refresh or try again.");
  } finally {
    window.clearTimeout(timeout);
  }
  let payload: ApiEnvelope<T>;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(`Request failed with status ${response.status}. Refresh and try again.`);
  }
  if (!response.ok || !payload.ok) {
    const issueMessage = payload.error?.issues?.map((issue) => issue.message).join(" ");
    const reference = payload.error?.correlationId ? ` Reference: ${payload.error.correlationId}.` : "";
    throw new Error(`${issueMessage || payload.error?.message || "Request failed."}${reference}`);
  }
  return payload.data;
}
