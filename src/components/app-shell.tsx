"use client";

import {
  ChevronDown,
  LogOut,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function Logo() {
  return (
    <div className="flex items-center gap-3 px-4 py-6">
      <div className="relative h-8 w-8">
        <span className="absolute left-1 top-0 h-5 w-5 rounded-full bg-blue-500" />
        <span className="absolute bottom-0 left-0 h-5 w-5 rounded-full bg-sky-400 mix-blend-multiply" />
        <span className="absolute bottom-1 right-0 h-5 w-5 rounded-full bg-indigo-500 mix-blend-multiply" />
      </div>
      <span className="text-base font-semibold tracking-normal text-slate-950">
        EvalOps Copilot
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [label, setLabel] = useState("No project selected");
  const [initials, setInitials] = useState("EO");
  const [userLabel, setUserLabel] = useState("EU");
  const authRoute = pathname.startsWith("/login") || pathname.startsWith("/auth/");

  useEffect(() => {
    if (authRoute) return;
    let alive = true;
    fetch("/api/app-state", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!alive || !payload.ok) return;
        const projectName = payload.data.activeProject?.name || "Create a project";
        const displayName = payload.data.user?.displayName || payload.data.user?.email || "EvalOps User";
        setLabel(projectName);
        setInitials(projectName.split(/\s+/).map((part: string) => part[0]).join("").slice(0, 2).toUpperCase());
        setUserLabel(displayName.split(/\s+/).map((part: string) => part[0]).join("").slice(0, 2).toUpperCase());
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pathname, authRoute]);

  if (authRoute) {
    return <>{children}</>;
  }

  function refreshWorkspace() {
    window.dispatchEvent(new CustomEvent("evalops:refresh"));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <Logo />
        <nav className="flex-1 space-y-1 px-2">
          {navItems.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-12 items-center gap-3 rounded-[7px] px-4 text-sm font-medium text-slate-600 transition",
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "hover:bg-slate-50 hover:text-slate-950",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 p-3">
          <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
            Production mode uses Supabase Auth, Postgres, and Storage. Local E2E keeps its explicit test store.
          </div>
        </div>
      </aside>

      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-20 items-center gap-3 px-4 lg:px-6">
            <Link href="/" className="flex shrink-0 items-center gap-2 lg:hidden">
              <div className="relative h-7 w-7">
                <span className="absolute left-1 top-0 h-4 w-4 rounded-full bg-blue-500" />
                <span className="absolute bottom-0 left-0 h-4 w-4 rounded-full bg-sky-400 mix-blend-multiply" />
                <span className="absolute bottom-1 right-0 h-4 w-4 rounded-full bg-indigo-500 mix-blend-multiply" />
              </div>
            </Link>
            <Link
              href="/projects"
              className="hidden h-11 w-72 items-center justify-between rounded-[8px] border border-slate-200 bg-white px-3 shadow-sm md:flex"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-violet-100 text-xs font-bold text-blue-700">
                  {initials}
                </span>
                <span className="truncate text-sm font-semibold text-slate-900">{label}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </Link>
            <div className="min-w-0 flex-1" />
            <button onClick={refreshWorkspace} aria-label="Refresh" className="h-11 w-11 rounded-[8px] border border-slate-200 bg-white shadow-sm">
              <RefreshCw className="mx-auto h-4 w-4 text-slate-600" />
            </button>
            <div className="flex h-11 items-center gap-2 rounded-full" aria-label="Current user">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-400 text-sm font-bold text-white">
                {userLabel}
              </span>
            </div>
            <form method="post" action="/logout">
              <button aria-label="Sign out" className="h-11 w-11 rounded-[8px] border border-slate-200 bg-white shadow-sm">
                <LogOut className="mx-auto h-4 w-4 text-slate-600" />
              </button>
            </form>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 lg:hidden">
            {navItems.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-2 rounded-[7px] px-3 text-xs font-semibold",
                    active ? "bg-blue-50 text-blue-700" : "text-slate-600",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
