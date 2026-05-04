"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  Layers3,
  Loader2,
  LockKeyhole,
  ShieldAlert,
  Target,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { WorkflowType } from "@/lib/domain/audit";
import { SELECTED_PROJECT_STORAGE_KEY } from "@/lib/project-selection";

type PrivacyMode = "redact_pii" | "derived_only" | "short_retention";

type ApiEnvelope<T> =
  | { ok: true; data: T; correlationId: string }
  | { ok: false; error: { code: string; message: string; correlationId: string } };

type WizardState = {
  name: string;
  workflowType: WorkflowType;
  objective: string;
  goals: string[];
  risks: string[];
  customRisks: string;
  privacyMode: PrivacyMode;
};

const steps = [
  {
    id: "workflow",
    label: "Workflow",
    title: "Create your first Eval Debt Audit",
    description: "Define the AI workflow so EvalOps can create a focused audit plan instead of a generic workspace.",
    icon: ClipboardCheck,
  },
  {
    id: "goals",
    label: "Quality goals",
    title: "Choose the outcomes this audit should prove",
    description: "Name the success criteria the eval system should measure from the first trace import onward.",
    icon: Target,
  },
  {
    id: "risks",
    label: "Risks",
    title: "Tell EvalOps what could go wrong",
    description: "Risk choices shape the starter eval cases, grader pack, and report recommendations.",
    icon: ShieldAlert,
  },
  {
    id: "privacy",
    label: "Privacy",
    title: "Set the data posture before upload",
    description: "Make redaction and retention explicit before any customer traces are retained.",
    icon: LockKeyhole,
  },
  {
    id: "review",
    label: "Review",
    title: "Review your audit blueprint",
    description: "Create the saved project, then continue directly into trace import with this plan attached.",
    icon: FileText,
  },
] as const;

const workflowOptions: Array<{
  value: WorkflowType;
  label: string;
  description: string;
}> = [
  {
    value: "support_assistant",
    label: "Support assistant",
    description: "Customer conversations, escalation paths, and policy-sensitive replies.",
  },
  {
    value: "rag",
    label: "RAG knowledge assistant",
    description: "Grounded answers over documentation, knowledge bases, or internal content.",
  },
  {
    value: "tool_agent",
    label: "Tool-using agent",
    description: "Agents that call APIs, complete tasks, or coordinate multi-step workflows.",
  },
  {
    value: "document_extraction",
    label: "Document extraction",
    description: "Structured outputs from invoices, claims, contracts, forms, or long documents.",
  },
  {
    value: "custom",
    label: "Custom workflow",
    description: "A workflow that needs a tailored audit frame.",
  },
];

const goalOptions = [
  "Answer accuracy",
  "Groundedness",
  "Safe escalation",
  "Cost efficiency",
  "Tool correctness",
  "Policy compliance",
];

const riskOptions = [
  "Hallucination",
  "Billing accuracy",
  "Data leakage",
  "Unsafe advice",
  "Failed escalation",
  "Policy drift",
];

const privacyOptions: Array<{
  value: PrivacyMode;
  label: string;
  description: string;
}> = [
  {
    value: "redact_pii",
    label: "Redact likely PII",
    description: "Detect and redact likely sensitive fields while preserving review context.",
  },
  {
    value: "short_retention",
    label: "Short raw-data retention",
    description: "Retain raw traces briefly so reviewers can validate generated eval artifacts.",
  },
  {
    value: "derived_only",
    label: "Store derived evals only",
    description: "Minimize raw trace retention and keep generated cases, graders, and reports.",
  },
];

const generatedOutputs = [
  {
    title: "Eval plan",
    items: ["Audit scope", "Evaluation approach", "Success criteria"],
  },
  {
    title: "Eval assets",
    items: ["Golden and regression cases", "Risk checks", "Grader pack"],
  },
  {
    title: "Evidence plan",
    items: ["Trace analysis", "Failure clustering", "Coverage map"],
  },
  {
    title: "First report",
    items: ["Prioritized findings", "Recommendations", "Export-ready summary"],
  },
];

const defaultState: WizardState = {
  name: "Support Assistant Audit",
  workflowType: "support_assistant",
  objective: "Measure answer quality, escalation safety, and refund policy reliability.",
  goals: ["Answer accuracy", "Safe escalation"],
  risks: ["Billing accuracy", "Failed escalation"],
  customRisks: "",
  privacyMode: "redact_pii",
};

export function OnboardingWizard() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [form, setForm] = useState<WizardState>(defaultState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = steps[index];
  const ActiveIcon = active.icon;
  const progress = useMemo(() => Math.round(((index + 1) / steps.length) * 100), [index]);
  const canContinue = canContinueFrom(index, form);

  function goToStep(nextIndex: number) {
    setError(null);
    setIndex(Math.max(0, Math.min(steps.length - 1, nextIndex)));
  }

  async function createAuditPlan() {
    setBusy(true);
    setError(null);
    try {
      const riskPreferences = normalizeRiskPreferences(form);
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          workflowType: form.workflowType,
          objective: form.objective.trim(),
          riskPreferences,
          privacyMode: form.privacyMode,
        }),
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!payload.ok) throw new Error(payload.error.message);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, payload.data.id);
        window.dispatchEvent(
          new CustomEvent("evalops:project-selected", {
            detail: { projectId: payload.data.id, source: "onboarding" },
          }),
        );
      }
      router.push("/trace-import");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create audit plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-20 max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 text-sm font-semibold text-slate-900">
            <BrandMark />
            <span>EvalOps Copilot</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/projects" className="text-sm font-semibold text-slate-600 hover:text-slate-950">
              Exit setup
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1240px] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[260px_1fr_380px] lg:py-8">
        <aside className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-950">Audit setup</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Build the saved audit plan before trace import.
            </p>
          </div>
          <div className="mt-4 h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <nav className="mt-5 space-y-1">
            {steps.map((step, stepIndex) => (
              <button
                key={step.id}
                type="button"
                onClick={() => goToStep(stepIndex)}
                className={[
                  "flex h-12 w-full items-center gap-3 rounded-[7px] px-3 text-left text-sm font-semibold transition",
                  stepIndex === index ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                ].join(" ")}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-current text-xs">
                  {stepIndex + 1}
                </span>
                <span>
                  <span className="block">{step.label}</span>
                  <span className="mt-0.5 block text-xs font-normal opacity-70">{stepHint(step.id)}</span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="rounded-[10px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 p-6 sm:p-8">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] bg-blue-50 text-blue-700 ring-1 ring-blue-100">
              <ActiveIcon className="h-5 w-5" />
            </span>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight tracking-normal text-slate-950">
              {active.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{active.description}</p>
          </div>

          <div className="p-6 sm:p-8">
            {active.id === "workflow" ? <WorkflowStep form={form} setForm={setForm} /> : null}
            {active.id === "goals" ? <GoalsStep form={form} setForm={setForm} /> : null}
            {active.id === "risks" ? <RisksStep form={form} setForm={setForm} /> : null}
            {active.id === "privacy" ? <PrivacyStep form={form} setForm={setForm} /> : null}
            {active.id === "review" ? <ReviewStep form={form} /> : null}

            {error ? (
              <div className="mt-5 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={index === 0 || busy}
                onClick={() => goToStep(index - 1)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[7px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              {index === steps.length - 1 ? (
                <button
                  type="button"
                  disabled={busy || !canContinue}
                  onClick={createAuditPlan}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[7px] bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  {busy ? "Creating..." : "Create audit plan"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canContinue || busy}
                  onClick={() => goToStep(index + 1)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[7px] bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </section>

        <AuditBlueprint form={form} activeStep={active.id} onEditStep={goToStep} />
      </div>
    </main>
  );
}

function WorkflowStep({
  form,
  setForm,
}: {
  form: WizardState;
  setForm: (value: WizardState) => void;
}) {
  return (
    <div className="grid gap-5">
      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Project name</span>
        <input
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          className="mt-2 h-11 w-full rounded-[7px] border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </label>
      <div>
        <p className="text-sm font-semibold text-slate-700">Workflow type</p>
        <div className="mt-3 grid gap-3">
          {workflowOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setForm({ ...form, workflowType: option.value })}
              className={[
                "flex min-h-20 items-start gap-3 rounded-[8px] border p-4 text-left transition",
                form.workflowType === option.value
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
              ].join(" ")}
            >
              <span
                className={[
                  "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  form.workflowType === option.value ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300",
                ].join(" ")}
              >
                {form.workflowType === option.value ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-950">{option.label}</span>
                <span className="mt-1 block text-sm leading-6 text-slate-600">{option.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GoalsStep({
  form,
  setForm,
}: {
  form: WizardState;
  setForm: (value: WizardState) => void;
}) {
  return (
    <div className="grid gap-5">
      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Evaluation objective</span>
        <textarea
          value={form.objective}
          onChange={(event) => setForm({ ...form, objective: event.target.value })}
          className="mt-2 min-h-28 w-full rounded-[7px] border border-slate-200 p-3 text-sm leading-6 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </label>
      <MultiSelectGrid
        label="Quality goals"
        options={goalOptions}
        selected={form.goals}
        onToggle={(goals) => setForm({ ...form, goals })}
      />
    </div>
  );
}

function RisksStep({
  form,
  setForm,
}: {
  form: WizardState;
  setForm: (value: WizardState) => void;
}) {
  return (
    <div className="grid gap-5">
      <MultiSelectGrid
        label="Primary risks"
        options={riskOptions}
        selected={form.risks}
        onToggle={(risks) => setForm({ ...form, risks })}
      />
      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Additional risks</span>
        <input
          value={form.customRisks}
          onChange={(event) => setForm({ ...form, customRisks: event.target.value })}
          className="mt-2 h-11 w-full rounded-[7px] border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="Example: refund abuse, missing audit trail"
        />
      </label>
    </div>
  );
}

function PrivacyStep({
  form,
  setForm,
}: {
  form: WizardState;
  setForm: (value: WizardState) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-700">Privacy preference</legend>
      <div className="mt-3 grid gap-3">
        {privacyOptions.map((option) => (
          <label
            key={option.value}
            className={[
              "flex min-h-20 cursor-pointer items-start gap-3 rounded-[8px] border p-4 transition",
              form.privacyMode === option.value
                ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
            ].join(" ")}
          >
            <input
              type="radio"
              name="privacyMode"
              value={option.value}
              checked={form.privacyMode === option.value}
              onChange={() => setForm({ ...form, privacyMode: option.value })}
              className="mt-1 h-4 w-4 accent-blue-600"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-950">{option.label}</span>
              <span className="mt-1 block text-sm leading-6 text-slate-600">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ReviewStep({ form }: { form: WizardState }) {
  return (
    <div className="grid gap-4">
      <ReviewRow label="Project" value={form.name.trim() || "Untitled audit"} />
      <ReviewRow label="Workflow" value={workflowLabel(form.workflowType)} />
      <ReviewRow label="Objective" value={form.objective.trim()} />
      <ReviewRow label="Goals" value={form.goals.join(", ")} />
      <ReviewRow label="Risks" value={normalizeRiskPreferences(form).join(", ")} />
      <ReviewRow label="Privacy" value={privacyLabel(form.privacyMode)} />
      <div className="rounded-[8px] border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm font-semibold text-blue-900">Next step: trace import</p>
        <p className="mt-2 text-sm leading-6 text-blue-800">
          After this plan is saved, you will upload CSV, JSON, NDJSON, or conversation logs against this audit blueprint.
        </p>
      </div>
    </div>
  );
}

function MultiSelectGrid({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (selected: string[]) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(toggleValue(selected, option))}
              className={[
                "flex min-h-20 items-start gap-3 rounded-[8px] border p-4 text-left transition",
                active
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
              ].join(" ")}
            >
              <CheckCircle2 className={active ? "mt-0.5 h-5 w-5 shrink-0 text-blue-600" : "mt-0.5 h-5 w-5 shrink-0 text-slate-300"} />
              <span className="text-sm font-semibold text-slate-900">{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AuditBlueprint({
  form,
  activeStep,
  onEditStep,
}: {
  form: WizardState;
  activeStep: (typeof steps)[number]["id"];
  onEditStep: (index: number) => void;
}) {
  const inputRows = [
    { label: "Workflow", value: workflowLabel(form.workflowType), stepIndex: 0 },
    { label: "Quality goals", value: form.goals.join(", ") || "Choose goals", stepIndex: 1 },
    { label: "Risks", value: normalizeRiskPreferences(form).join(", ") || "Choose risks", stepIndex: 2 },
    { label: "Privacy", value: privacyLabel(form.privacyMode), stepIndex: 3 },
  ];

  return (
    <aside className="rounded-[10px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
      <div className="border-b border-slate-100 p-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] bg-blue-50 text-blue-700 ring-1 ring-blue-100">
            <Layers3 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-950">Audit blueprint</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Live plan for {form.name.trim() || "your audit"}</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-500">
          <span>Inputs</span>
          <span>Outputs</span>
          <span>Report</span>
        </div>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-3">
            {inputRows.map((row) => (
              <button
                key={row.label}
                type="button"
                aria-label={`Edit ${row.label}`}
                onClick={() => onEditStep(row.stepIndex)}
                className={[
                  "rounded-[8px] border p-3 text-left transition",
                  steps[row.stepIndex].id === activeStep
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-slate-50 hover:bg-white",
                ].join(" ")}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">{row.label}</span>
                  <span className="text-xs font-semibold text-blue-700">Edit</span>
                </span>
                <span className="mt-1 block text-sm font-semibold leading-5 text-slate-950">{row.value}</span>
              </button>
            ))}
          </div>

          <div className="rounded-[8px] border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-950">Generated outputs</p>
            <div className="mt-4 grid gap-3">
              {generatedOutputs.map((output) => (
                <div key={output.title} className="rounded-[7px] border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{output.title}</p>
                  <ul className="mt-2 space-y-1">
                    {output.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs leading-5 text-slate-600">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[8px] border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">Trace import next</p>
            <p className="mt-2 text-sm leading-6 text-blue-800">
              Upload evidence, map fields, redact likely PII, and generate the first eval assets from this plan.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function BrandMark() {
  return (
    <span className="relative h-8 w-8 shrink-0">
      <span className="absolute left-1 top-0 h-5 w-5 rounded-full bg-blue-500" />
      <span className="absolute bottom-0 left-0 h-5 w-5 rounded-full bg-sky-400 mix-blend-multiply" />
      <span className="absolute bottom-1 right-0 h-5 w-5 rounded-full bg-indigo-500 mix-blend-multiply" />
    </span>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-950">{value || "Not set"}</p>
    </div>
  );
}

function stepHint(stepId: (typeof steps)[number]["id"]) {
  return {
    workflow: "Define how you work",
    goals: "What good looks like",
    risks: "What could go wrong",
    privacy: "Data use and handling",
    review: "Confirm and start",
  }[stepId];
}

function workflowLabel(value: WorkflowType) {
  return workflowOptions.find((option) => option.value === value)?.label || "Custom workflow";
}

function privacyLabel(value: PrivacyMode) {
  return privacyOptions.find((option) => option.value === value)?.label || "Redact likely PII";
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function normalizeRiskPreferences(form: WizardState) {
  const custom = form.customRisks
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set([...form.goals, ...form.risks, ...custom]));
}

function canContinueFrom(index: number, form: WizardState) {
  if (index === 0) return form.name.trim().length >= 2 && Boolean(form.workflowType);
  if (index === 1) return form.objective.trim().length >= 10 && form.goals.length > 0;
  if (index === 2) return form.risks.length > 0 || form.customRisks.trim().length > 0;
  if (index === 3) return Boolean(form.privacyMode);
  return true;
}
