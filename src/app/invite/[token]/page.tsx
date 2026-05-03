import Link from "next/link";
import { InviteAcceptance } from "@/components/invite-acceptance";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <section className="mx-auto max-w-xl rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-blue-700">EvalOps Copilot invitation</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          Join your organization workspace
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign in or create your account with the invited email, then accept the invitation here.
        </p>
        <div className="mt-5 rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          Invite token ending: <span className="font-mono text-slate-900">{token.slice(-8)}</span>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
            className="inline-flex h-11 items-center justify-center rounded-[8px] bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm"
          >
            Sign in
          </Link>
          <Link
            href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}
            className="inline-flex h-11 items-center justify-center rounded-[8px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm"
          >
            Create account
          </Link>
        </div>
        <InviteAcceptance token={token} />
      </section>
    </main>
  );
}
