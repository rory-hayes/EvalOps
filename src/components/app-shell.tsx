"use client";

import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, project } from "@/data/evalops";
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
        <div className="space-y-5 p-3">
          <div className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Upgrade your plan
            </div>
            <p className="text-xs leading-5 text-slate-500">
              Unlock advanced analytics, custom reports, and more.
            </p>
            <button className="mt-4 h-9 w-full rounded-[7px] border border-slate-200 text-sm font-semibold text-blue-600">
              View plans
            </button>
          </div>
          <div className="flex items-center justify-between px-2 pb-2 text-sm font-medium text-slate-600">
            <span className="flex items-center gap-2">
              <CircleHelp className="h-4 w-4" />
              Help & feedback
            </span>
            <ChevronDown className="h-4 w-4 -rotate-90" />
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
              className="hidden h-11 w-64 items-center justify-between rounded-[8px] border border-slate-200 bg-white px-3 shadow-sm md:flex"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-violet-100 text-xs font-bold text-blue-700">
                  {project.initials}
                </span>
                <span className="text-sm font-semibold text-slate-900">{project.name}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </Link>
            <label className="relative flex h-11 min-w-0 flex-1 items-center">
              <Search className="pointer-events-none absolute left-4 h-4 w-4 text-slate-500" />
              <input
                aria-label="Search"
                className="h-full w-full rounded-[8px] border border-slate-200 bg-white pl-11 pr-14 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                placeholder="Search evaluations, projects, metrics..."
              />
              <span className="absolute right-3 rounded-[5px] border border-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-400">
                ⌘K
              </span>
            </label>
            <button className="hidden h-11 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm xl:flex">
              <CalendarDays className="h-4 w-4" />
              {project.dateRange}
              <ChevronDown className="h-4 w-4" />
            </button>
            <button aria-label="Refresh" className="h-11 w-11 rounded-[8px] border border-slate-200 bg-white shadow-sm">
              <RefreshCw className="mx-auto h-4 w-4 text-slate-600" />
            </button>
            <button aria-label="Notifications" className="hidden h-11 w-11 rounded-[8px] border border-slate-200 bg-white shadow-sm sm:block">
              <Bell className="mx-auto h-4 w-4 text-slate-600" />
            </button>
            <button className="flex h-11 items-center gap-2 rounded-full">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-400 text-sm font-bold text-white">
                AM
              </span>
              <ChevronDown className="hidden h-4 w-4 text-slate-500 sm:block" />
            </button>
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
