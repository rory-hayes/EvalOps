import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  FileText,
  Mail,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

type LegalPageLink = {
  href: string;
  label: string;
};

type LegalSection = {
  title: string;
  body?: string;
  items?: string[];
};

type LegalPageProps = {
  title: string;
  description: string;
  updated: string;
  reviewNote?: string;
  sections: LegalSection[];
  aside?: {
    title: string;
    body: string;
    links?: LegalPageLink[];
  };
};

const legalLinks = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/dpa", label: "DPA" },
  { href: "/subprocessors", label: "Subprocessors" },
  { href: "/contact", label: "Contact" },
];

export function LegalPage({
  title,
  description,
  updated,
  reviewNote = "Placeholder commercial terms for launch preparation. This page must be reviewed by qualified counsel before being used as binding legal language.",
  sections,
  aside,
}: LegalPageProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1120px] flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="relative h-8 w-8 shrink-0">
              <span className="absolute left-1 top-0 h-5 w-5 rounded-full bg-blue-500" />
              <span className="absolute bottom-0 left-0 h-5 w-5 rounded-full bg-sky-400 mix-blend-multiply" />
              <span className="absolute bottom-1 right-0 h-5 w-5 rounded-full bg-indigo-500 mix-blend-multiply" />
            </span>
            <span className="text-base font-semibold">EvalOps Copilot</span>
          </Link>
          <nav aria-label="Legal pages" className="flex flex-wrap gap-2">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex h-9 items-center rounded-[7px] px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1120px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-[8px] border border-slate-200 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 p-6 sm:p-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to EvalOps Copilot
            </Link>
            <div className="mt-7 flex items-start gap-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-500">Last updated: {updated}</p>
                <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-normal text-slate-950">
                  {title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  {description}
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3 rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{reviewNote}</p>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {sections.map((section) => (
              <section key={section.title} className="p-6 sm:p-8">
                <h2 className="text-xl font-semibold tracking-normal text-slate-950">
                  {section.title}
                </h2>
                {section.body ? (
                  <p className="mt-3 text-sm leading-6 text-slate-600">{section.body}</p>
                ) : null}
                {section.items ? (
                  <ul className="mt-4 grid gap-3">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_8px_26px_rgba(15,23,42,0.06)]">
            <h2 className="text-sm font-semibold text-slate-950">
              {aside?.title ?? "Commercial launch note"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {aside?.body ??
                "These pages are written for a private MVP launch posture and should be finalized with counsel before broad commercial use."}
            </p>
            {aside?.links ? (
              <div className="mt-4 grid gap-2">
                {aside.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    {link.label}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <div className="rounded-[8px] border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-950">Need help?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              For support, security, privacy, or incident escalation, use the contact page and include the relevant workspace, project, and timeline details.
            </p>
            <Link
              href="/contact"
              className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-[7px] bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
            >
              <Mail className="h-4 w-4" />
              Contact EvalOps
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
