import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  LockKeyhole,
  Route,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const auditOutputs = [
  "Intent map and coverage gaps",
  "Starter golden, regression, edge, and safety cases",
  "Grader pack with calibration warnings",
  "Prompt, routing, and caching recommendations",
  "Executive-ready Eval Debt Audit report",
];

const workflowSteps = [
  {
    title: "Set the audit frame",
    detail: "Pick the workflow, goals, risk areas, and privacy posture before importing anything.",
    icon: ClipboardCheck,
  },
  {
    title: "Import traces safely",
    detail: "Upload real examples, preview what was found, and redact likely PII before review.",
    icon: UploadCloud,
  },
  {
    title: "Generate the eval system",
    detail: "Turn traces into cases, graders, failure clusters, and a first report draft.",
    icon: Sparkles,
  },
  {
    title: "Act on recommendations",
    detail: "Review optimizer, routing, caching, and report guidance with a clear evidence trail.",
    icon: Route,
  },
];

export function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <span className="text-base font-semibold">EvalOps Copilot</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#workflow" className="hover:text-slate-950">Workflow</a>
            <a href="#outputs" className="hover:text-slate-950">Outputs</a>
            <a href="#screens" className="hover:text-slate-950">Product</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden h-10 items-center rounded-[7px] px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/signup?next=/onboarding"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[7px] bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-[1180px] items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-18">
        <div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-normal text-slate-950 sm:text-6xl">
            Create, maintain, and improve high-quality AI evals.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            EvalOps Copilot turns prompts, traces, requirements, and known failures into a living Eval Debt Audit with cases, graders, recommendations, and a customer-ready report.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup?next=/onboarding"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[7px] bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#screens"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[7px] border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              View sample report
            </Link>
          </div>
          <div className="mt-8 grid max-w-xl gap-3 text-sm text-slate-600 sm:grid-cols-3">
            <ProofPoint label="Private MVP" value="Service-assisted audit" />
            <ProofPoint label="Primary input" value="Traces and prompts" />
            <ProofPoint label="Output" value="Eval pack and report" />
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-4 top-8 hidden h-48 w-48 rounded-full bg-blue-100 blur-3xl lg:block" />
          <div className="relative rounded-[10px] border border-slate-200 bg-slate-50 p-3 shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
            <Image
              src="/landing/dashboard.png"
              alt="EvalOps Copilot dashboard showing eval health, coverage, and audit activity"
              width={1440}
              height={950}
              priority
              className="aspect-[16/10] w-full rounded-[8px] border border-slate-200 bg-white object-cover object-left-top"
            />
          </div>
          <div className="absolute -bottom-6 right-6 hidden w-[58%] rounded-[10px] border border-slate-200 bg-white p-2 shadow-[0_18px_55px_rgba(15,23,42,0.18)] md:block">
            <Image
              src="/landing/report.png"
              alt="EvalOps Copilot audit report preview"
              width={1440}
              height={950}
              loading="eager"
              className="aspect-[16/10] w-full rounded-[7px] border border-slate-200 object-cover object-left-top"
            />
          </div>
        </div>
      </section>

      <section id="workflow" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-normal">A guided path from messy traces to a usable eval system.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              The setup flow makes the audit explicit before generation starts, so users know what will be created and why each step matters.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workflowSteps.map((step) => (
              <div key={step.title} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                  <step.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-base font-semibold text-slate-950">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="outputs" className="mx-auto grid max-w-[1180px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <h2 className="text-3xl font-semibold tracking-normal">The aha moment is concrete.</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            After the first trace import, the user should see what was detected, what was generated, and what needs review. No vague “AI magic” states.
          </p>
          <Link
            href="/signup?next=/onboarding"
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-[7px] bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-3">
          {auditOutputs.map((output) => (
            <div key={output} className="flex items-center gap-3 rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600" />
              <span className="text-sm font-medium text-slate-800">{output}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="screens" className="border-t border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-normal">Built around the audit workflow.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                Dashboard, eval cases, graders, optimizer, routing, caching, and reports all point back to one customer workflow.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[7px] bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Open product dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <ScreenshotCard src="/landing/eval-builder.png" alt="Eval Builder with generated cases and review issue detail" title="Generated cases and review issues" />
            <ScreenshotCard src="/landing/report.png" alt="Audit report with readiness score and recommendations" title="Report-ready recommendations" />
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <MiniCapability icon={ShieldCheck} title="Calibration" detail="Flag low-agreement graders before trust erodes." />
            <MiniCapability icon={BarChart3} title="Coverage" detail="Show which intents are measured and which are thin." />
            <MiniCapability icon={LockKeyhole} title="Privacy" detail="Make redaction and retention part of setup." />
          </div>
        </div>
      </section>
    </main>
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

function ProofPoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ScreenshotCard({ src, alt, title }: { src: string; alt: string; title: string }) {
  return (
    <figure className="rounded-[10px] border border-white/10 bg-white/5 p-3">
      <Image
        src={src}
        alt={alt}
        width={1440}
        height={950}
        loading="eager"
        className="aspect-[16/10] w-full rounded-[8px] border border-white/10 object-cover object-left-top"
      />
      <figcaption className="px-1 pt-3 text-sm font-semibold text-slate-200">{title}</figcaption>
    </figure>
  );
}

function MiniCapability({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof ShieldCheck;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-[8px] border border-white/10 bg-white/5 p-4">
      <Icon className="h-5 w-5 text-sky-300" />
      <h3 className="mt-4 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
    </div>
  );
}
