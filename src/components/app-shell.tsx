"use client";

import { LogOut, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function BrandMark() {
  return (
    <span className="relative h-8 w-8 shrink-0">
      <span className="absolute left-1 top-0 h-5 w-5 rounded-full bg-blue-500" />
      <span className="absolute bottom-0 left-0 h-5 w-5 rounded-full bg-sky-400 mix-blend-multiply" />
      <span className="absolute bottom-1 right-0 h-5 w-5 rounded-full bg-indigo-500 mix-blend-multiply" />
    </span>
  );
}

function Logo() {
  return (
    <Link href="/workspace" className="flex items-center gap-3 px-4 py-6">
      <BrandMark />
      <span className="min-w-0">
        <span className="block text-base font-semibold tracking-normal text-slate-950">
          Evaller
        </span>
        <span className="mt-0.5 block text-xs font-medium text-slate-500">
          Release readiness
        </span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const publicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/dpa") ||
    pathname.startsWith("/subprocessors") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/invite");
  const activeItem = navItems.find((item) => pathname.startsWith(item.href)) || navItems[0];

  if (publicRoute) {
    return <>{children}</>;
  }

  function refreshWorkspace() {
    window.dispatchEvent(new CustomEvent("evaller:refresh"));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <Logo />
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex h-12 items-center gap-3 rounded-[8px] px-3 text-sm font-semibold text-slate-600 transition",
                  active
                    ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                    : "hover:bg-slate-50 hover:text-slate-950",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-[8px] transition",
                    active ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 group-hover:bg-white",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <div className="rounded-[8px] border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-blue-900">
            <p className="font-semibold text-blue-950">Private test loop</p>
            <p className="mt-1">
              Server-side AI runs, saved prompt versions, and review approvals in one workspace.
            </p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex min-h-20 items-center gap-3 px-4 lg:px-6">
            <Link href="/workspace" className="flex shrink-0 items-center gap-2 lg:hidden">
              <BrandMark />
              <span className="font-semibold text-slate-950">Evaller</span>
            </Link>
            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="text-sm font-semibold text-slate-950">{activeItem.label}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">Support AI release readiness loop</p>
            </div>
            <nav className="hidden flex-1 items-center gap-1 md:flex lg:hidden">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-[8px] px-3 text-sm font-semibold",
                    pathname.startsWith(item.href)
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="min-w-0 flex-1 md:hidden" />
            <button
              onClick={refreshWorkspace}
              aria-label="Refresh"
              className="h-11 w-11 rounded-[8px] border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw className="mx-auto h-4 w-4 text-slate-600" />
            </button>
            <form method="post" action="/logout">
              <button
                aria-label="Sign out"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4 text-slate-600" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
          <nav className="grid grid-cols-4 gap-1 border-t border-slate-100 px-2 py-2 md:hidden">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-1 rounded-[7px] text-[11px] font-semibold",
                  pathname.startsWith(item.href)
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}
