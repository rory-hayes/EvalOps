import { ArrowRight, CheckCircle2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { signup } from "@/app/login/actions";
import { resolveAuthRedirectPath } from "@/app/login/redirects";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";

type SignupPageProps = {
  searchParams?: Promise<{
    error?: string;
    next?: string;
  }>;
};

const setupPromises = [
  "Create a saved Eval Debt Audit plan",
  "Keep privacy posture explicit before upload",
  "Move straight into trace import when ready",
];

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = (await searchParams) || {};
  const next = resolveAuthRedirectPath(params.next || "/onboarding");
  const configured = hasSupabasePublicConfig();

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-[1120px] items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.12)] lg:grid-cols-[0.95fr_1.05fr]">
          <section className="border-b border-slate-200 bg-slate-950 p-7 text-white sm:p-8 lg:border-b-0 lg:border-r">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="relative h-9 w-9">
                <span className="absolute left-1 top-0 h-5 w-5 rounded-full bg-blue-400" />
                <span className="absolute bottom-0 left-0 h-5 w-5 rounded-full bg-sky-300 mix-blend-screen" />
                <span className="absolute bottom-1 right-0 h-5 w-5 rounded-full bg-indigo-400 mix-blend-screen" />
              </span>
              <span className="text-lg font-semibold">EvalOps Copilot</span>
            </Link>

            <div className="mt-16 max-w-md">
              <h1 className="text-4xl font-semibold tracking-normal">
                Create your EvalOps account
              </h1>
              <p className="mt-5 text-sm leading-6 text-slate-300">
                Start with a saved audit setup, then bring traces, prompts, requirements, and known failures into one focused Eval Debt Audit workflow.
              </p>
              <div className="mt-7 grid gap-3">
                {setupPromises.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-sky-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="p-6 sm:p-8">
            <div className="mx-auto max-w-md">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="mt-6 text-2xl font-semibold">Get started with your first audit</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Create an account to keep the setup answers, privacy choices, generated eval assets, and reports tied to your workspace.
              </p>

              {params.error ? (
                <div className="mt-5 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {params.error}
                </div>
              ) : null}
              {!configured ? (
                <div className="mt-5 rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Supabase authentication is not configured for this environment.
                </div>
              ) : null}

              <form className="mt-6 grid gap-4">
                <input type="hidden" name="source" value="signup" />
                <input type="hidden" name="next" value={next} />
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Email</span>
                  <span className="mt-2 flex h-11 items-center gap-2 rounded-[7px] border border-slate-200 px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
                      placeholder="founder@example.com"
                    />
                  </span>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Password</span>
                  <span className="mt-2 flex h-11 items-center gap-2 rounded-[7px] border border-slate-200 px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                    <LockKeyhole className="h-4 w-4 text-slate-400" />
                    <input
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
                      placeholder="At least 8 characters"
                    />
                  </span>
                </label>
                <button
                  formAction={signup}
                  disabled={!configured}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[7px] bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <p className="mt-5 text-sm text-slate-600">
                Already have an account?{" "}
                <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-blue-700 hover:text-blue-800">
                  Sign in
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
