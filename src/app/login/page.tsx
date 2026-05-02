import { LockKeyhole, Mail } from "lucide-react";
import { login, signup } from "./actions";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) || {};
  const next = params.next && params.next.startsWith("/") ? params.next : "";
  const configured = hasSupabasePublicConfig();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[1120px] items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.10)] lg:grid-cols-[0.95fr_1.05fr]">
          <section className="border-b border-slate-200 bg-slate-950 p-8 text-white lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3">
              <div className="relative h-9 w-9">
                <span className="absolute left-1 top-0 h-5 w-5 rounded-full bg-blue-400" />
                <span className="absolute bottom-0 left-0 h-5 w-5 rounded-full bg-sky-300 mix-blend-screen" />
                <span className="absolute bottom-1 right-0 h-5 w-5 rounded-full bg-indigo-400 mix-blend-screen" />
              </div>
              <span className="text-lg font-semibold">EvalOps Copilot</span>
            </div>
            <div className="mt-16 max-w-md">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">Private MVP Access</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-normal">
                Sign in to review eval debt with persisted, traceable workflows.
              </h1>
              <p className="mt-5 text-sm leading-6 text-slate-300">
                Supabase Auth now owns sign-in and user identity. Workspace records, uploaded traces, review issues, exports, and audit events stay tied to your authenticated user.
              </p>
            </div>
          </section>

          <section className="p-6 sm:p-8">
            <div className="mx-auto max-w-md">
              <h2 className="text-2xl font-semibold">Welcome back</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use your EvalOps account email and password. New private-test users can request access by signing up.
              </p>

              {params.error ? (
                <div className="mt-5 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {params.error}
                </div>
              ) : null}
              {params.message ? (
                <div className="mt-5 rounded-[8px] border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                  {params.message}
                </div>
              ) : null}
              {!configured ? (
                <div className="mt-5 rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Supabase authentication is not configured for this environment.
                </div>
              ) : null}

              <form className="mt-6 grid gap-4">
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
                      autoComplete="current-password"
                      required
                      minLength={8}
                      className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
                      placeholder="At least 8 characters"
                    />
                  </span>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    formAction={login}
                    disabled={!configured}
                    className="inline-flex h-11 items-center justify-center rounded-[7px] bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    Sign in
                  </button>
                  <button
                    formAction={signup}
                    disabled={!configured}
                    className="inline-flex h-11 items-center justify-center rounded-[7px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    Create account
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
