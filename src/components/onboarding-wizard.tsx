"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  LockKeyhole,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const steps = [
  {
    id: "workflow",
    label: "Workflow",
    title: "Set up your Eval Debt Audit",
    description: "Start by naming the AI workflow so the audit has a clear boundary.",
    options: ["Support assistant", "RAG knowledge assistant", "Tool-using agent", "Document extraction"],
    icon: ClipboardCheck,
  },
  {
    id: "goals",
    label: "Goals",
    title: "Choose what good means",
    description: "The audit works best when quality, risk, and business goals are explicit before generation.",
    options: ["Answer quality", "Escalation safety", "Groundedness", "Cost efficiency"],
    icon: Sparkles,
  },
  {
    id: "inputs",
    label: "Inputs",
    title: "Bring the evidence",
    description: "EvalOps Copilot uses the materials your team already has to create a starter eval system.",
    options: ["Trace CSV or JSON", "Current prompt", "Requirements or policy docs", "Known failures"],
    icon: UploadCloud,
  },
  {
    id: "privacy",
    label: "Privacy",
    title: "Decide what can be retained",
    description: "Redaction and retention belong in the setup flow, not as a buried admin setting.",
    options: ["Redact likely PII", "Prefer derived artifacts", "Short retention for raw traces", "Export-ready audit trail"],
    icon: LockKeyhole,
  },
  {
    id: "preview",
    label: "Preview",
    title: "See the first aha moment",
    description: "After import, the user should immediately understand what was found and what to review next.",
    options: ["Intent coverage map", "Generated eval cases", "Grader pack", "Executive report draft"],
    icon: FileText,
  },
];

export function OnboardingWizard() {
  const [index, setIndex] = useState(0);
  const active = steps[index];
  const progress = useMemo(() => Math.round(((index + 1) / steps.length) * 100), [index]);
  const ActiveIcon = active.icon;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-20 max-w-[1180px] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 text-sm font-semibold text-slate-900">
            <span className="relative h-8 w-8">
              <span className="absolute left-1 top-0 h-5 w-5 rounded-full bg-blue-500" />
              <span className="absolute bottom-0 left-0 h-5 w-5 rounded-full bg-sky-400 mix-blend-multiply" />
              <span className="absolute bottom-1 right-0 h-5 w-5 rounded-full bg-indigo-500 mix-blend-multiply" />
            </span>
            EvalOps Copilot
          </Link>
          <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-950">
            Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1180px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[300px_1fr] lg:py-10">
        <aside className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-950">Audit setup</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">A preview of the guided journey before the workspace opens.</p>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <nav className="mt-5 space-y-1">
            {steps.map((step, stepIndex) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setIndex(stepIndex)}
                className={[
                  "flex h-11 w-full items-center gap-3 rounded-[7px] px-3 text-left text-sm font-semibold transition",
                  stepIndex === index ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                ].join(" ")}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-current text-xs">
                  {stepIndex + 1}
                </span>
                {step.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
            <div className="p-6 sm:p-8">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                <ActiveIcon className="h-5 w-5" />
              </span>
              <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-tight tracking-normal text-slate-950">
                {active.title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">{active.description}</p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {active.options.map((option, optionIndex) => (
                  <div key={option} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className={optionIndex === 0 ? "h-5 w-5 text-blue-600" : "h-5 w-5 text-slate-400"} />
                      <span className="text-sm font-semibold text-slate-800">{option}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => setIndex((value) => Math.max(0, value - 1))}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[7px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
                {index === steps.length - 1 ? (
                  <Link
                    href="/projects"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[7px] bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
                  >
                    Continue to project setup
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIndex((value) => Math.min(steps.length - 1, value + 1))}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[7px] bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-950 p-6 text-white lg:border-l lg:border-t-0">
              <p className="text-sm font-semibold text-sky-200">Aha moment preview</p>
              <div className="mt-5 rounded-[8px] border border-white/10 bg-white/5 p-4">
                <p className="text-4xl font-semibold">2 intents</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Detected from the first trace import with one high-priority review issue.</p>
              </div>
              <div className="mt-3 rounded-[8px] border border-white/10 bg-white/5 p-4">
                <p className="text-4xl font-semibold">12 cases</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Generated across golden, regression, edge, and safety sets.</p>
              </div>
              <div className="mt-3 rounded-[8px] border border-white/10 bg-white/5 p-4">
                <p className="text-4xl font-semibold">1 report</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Drafted with risks, recommendations, and a next-action list.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
