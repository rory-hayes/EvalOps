import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  History,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const proofPoints = [
  "Prompt, scenarios, criteria, and run history in one workspace",
  "Before and after evidence for every prompt fix",
  "Release review notes tied to the exact prompt version",
];

const workflowSteps = [
  {
    title: "Frame the release check",
    detail: "Describe the AI feature, add realistic support scenarios, and set the quality bar.",
    icon: ClipboardCheck,
  },
  {
    title: "Run the AI test",
    detail: "Score each response against the success criteria and surface missed behavior clearly.",
    icon: Sparkles,
  },
  {
    title: "Approve with evidence",
    detail: "Apply fixes, compare the next run, and copy a readiness report for your team.",
    icon: ShieldCheck,
  },
];

const screenshots = [
  {
    src: "/landing/evaller-runs.png",
    alt: "Evaller Runs History showing a selected run, pass-rate trend, and release readiness report",
    title: "Runs History",
    detail: "Track pass-rate movement and inspect the exact run behind a release decision.",
  },
  {
    src: "/landing/evaller-settings.png",
    alt: "Evaller Settings showing workspace control, team review, prompt versions, and privacy posture",
    title: "Settings and Prompt Versions",
    detail: "Keep prompt history, team review, and AI privacy posture visible.",
  },
  {
    src: "/landing/evaller-templates.png",
    alt: "Evaller Templates showing a support AI release check starter workspace",
    title: "Starter Templates",
    detail: "Start with a focused support AI readiness template, then make it your own.",
  },
];

export function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <span>
              <span className="block text-base font-semibold">Evaller</span>
              <span className="mt-0.5 block text-xs font-medium text-slate-500">Release readiness</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#workflow" className="hover:text-slate-950">Workflow</a>
            <a href="#screens" className="hover:text-slate-950">Screens</a>
            <a href="#trust" className="hover:text-slate-950">Trust</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden h-10 items-center rounded-[8px] px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/signup?next=/workspace"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
            >
              Create account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative isolate min-h-[calc(100svh-160px)] overflow-hidden bg-slate-950">
        <Image
          src="/landing/evaller-workspace.png"
          alt="Evaller Workspace Cockpit with release readiness score, next recommended action, and latest result"
          fill
          priority
          sizes="100vw"
          className="object-cover object-left-top opacity-70"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.96)_0%,rgba(15,23,42,0.82)_35%,rgba(15,23,42,0.22)_72%,rgba(15,23,42,0.04)_100%)]" />
        <div className="relative mx-auto flex min-h-[calc(100svh-160px)] max-w-[1180px] items-center px-4 py-16 sm:px-6">
          <div className="max-w-2xl text-white">
            <p className="text-sm font-semibold uppercase tracking-normal text-sky-200">Support AI release checks</p>
            <h1 className="mt-5 text-6xl font-semibold leading-[0.98] tracking-normal sm:text-7xl">
              Evaller
            </h1>
            <p className="mt-6 max-w-xl text-xl leading-8 text-slate-100">
              Test support AI prompts before release, apply fixes with evidence, and share a readiness report your team can trust.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup?next=/workspace"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-blue-500 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-950/30 transition hover:bg-blue-400"
              >
                Create account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#screens"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                See what you get
              </a>
            </div>
            <div className="mt-8 grid gap-3 text-sm leading-6 text-slate-200">
              {proofPoints.map((point) => (
                <div key={point} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-sky-300" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="text-sm font-semibold text-blue-700">How it works</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal">
                One focused loop from prompt to release decision.
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Evaller keeps the first workflow tight: support AI prompt, realistic user scenarios, quality criteria, run results, prompt fixes, and review approval.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {workflowSteps.map((step) => (
                <div key={step.title} className="rounded-[8px] border border-slate-200 bg-slate-50 p-5">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-slate-950">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{step.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="screens" className="bg-slate-50">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700">Product screens</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal">
                The workspace buyers see after sign-up.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
                These are live screenshots from the current Evaller app, using a support AI release check with before and after run evidence.
              </p>
            </div>
            <Link
              href="/signup?next=/workspace"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open your workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 rounded-[8px] border border-slate-200 bg-white p-3 shadow-[0_18px_60px_rgba(15,23,42,0.10)]">
            <Image
              src="/landing/evaller-workspace.png"
              alt="Evaller Workspace Cockpit showing release readiness, next recommended action, quality bar, and latest result"
              width={1440}
              height={1000}
              loading="eager"
              className="aspect-[16/10] w-full rounded-[8px] border border-slate-200 object-cover object-left-top"
            />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {screenshots.map((screenshot) => (
              <ScreenshotCard key={screenshot.title} {...screenshot} />
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-semibold text-blue-700">Why teams use it</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal">
              Move from “the prompt seems fine” to reviewed release evidence.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Evaller is intentionally narrow: it helps teams make a support AI release decision with a traceable test loop, not a sprawling observability platform.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <MiniCapability icon={BarChart3} title="Before and after" detail="See whether the fix improved pass rate, not just whether it sounded better." />
            <MiniCapability icon={History} title="Prompt history" detail="Each run stays attached to the prompt version that produced it." />
            <MiniCapability icon={LockKeyhole} title="Server-side AI" detail="OpenAI credentials stay server-side, with no customer key entry in the UI." />
          </div>
        </div>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-normal">Create your first release check.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Start with one support AI prompt, three realistic scenarios, and a readiness report your team can review.
            </p>
          </div>
          <Link
            href="/signup?next=/workspace"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Create account
            <ArrowRight className="h-4 w-4" />
          </Link>
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

function ScreenshotCard({
  src,
  alt,
  title,
  detail,
}: {
  src: string;
  alt: string;
  title: string;
  detail: string;
}) {
  return (
    <figure className="rounded-[8px] border border-slate-200 bg-white p-3 shadow-sm">
      <Image
        src={src}
        alt={alt}
        width={1440}
        height={1000}
        loading="eager"
        className="aspect-[16/10] w-full rounded-[8px] border border-slate-200 object-cover object-left-top"
      />
      <figcaption className="px-1 pt-4">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
      </figcaption>
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
    <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
      <Icon className="h-5 w-5 text-blue-700" />
      <h3 className="mt-4 text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}
