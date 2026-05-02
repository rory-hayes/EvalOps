import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const toneClasses = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  orange: "bg-orange-50 text-orange-700 ring-orange-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  red: "bg-red-50 text-red-700 ring-red-100",
  slate: "bg-slate-50 text-slate-700 ring-slate-100",
};

export type Tone = keyof typeof toneClasses;

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[8px] border border-slate-200/80 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  type,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type ?? "button"}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-[7px] px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55",
        variant === "primary" &&
          "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700",
        variant === "secondary" &&
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-[7px] px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        variant === "primary" &&
          "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700",
        variant === "secondary" &&
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[5px] px-2 py-1 text-xs font-semibold ring-1",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function IconTile({
  icon: Icon,
  tone = "blue",
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] ring-1",
        toneClasses[tone],
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-normal text-slate-950">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
        {meta ? <div className="mt-4">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "blue",
  className,
}: {
  value: number;
  tone?: Tone;
  className?: string;
}) {
  const barColor = {
    blue: "bg-blue-600",
    emerald: "bg-emerald-500",
    green: "bg-emerald-500",
    violet: "bg-violet-500",
    orange: "bg-orange-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    slate: "bg-slate-500",
  }[tone];

  return (
    <div className={cn("h-2 rounded-full bg-slate-100", className)}>
      <div
        className={cn("h-full rounded-full", barColor)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function RowLink({ children }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
      {children ?? "View details"}
      <ChevronRight className="h-4 w-4" />
    </span>
  );
}
