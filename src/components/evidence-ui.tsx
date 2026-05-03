"use client";

import { Badge, Card, ProgressBar, type Tone } from "@/components/primitives";
import { cn } from "@/lib/utils";

export type EvidenceListItem = {
  id?: string;
  type?: string;
  label: string;
  excerpt?: string;
  detail?: string;
  confidence?: number | null;
};

export type EvidenceListProps = {
  items: readonly EvidenceListItem[];
  title?: string;
  emptyText?: string;
  maxItems?: number;
  className?: string;
};

export function EvidenceList({
  items,
  title = "Evidence",
  emptyText = "No evidence references yet.",
  maxItems,
  className,
}: EvidenceListProps) {
  const visibleLimit = maxItems ?? items.length;
  const visibleItems = items.slice(0, Math.max(0, visibleLimit));
  const remainingCount = Math.max(0, items.length - visibleItems.length);

  return (
    <div className={cn("rounded-[8px] border border-slate-200 bg-white", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <Badge tone={items.length ? "blue" : "slate"}>{formatEvidenceCount(items.length)}</Badge>
      </div>
      {visibleItems.length ? (
        <ul className="divide-y divide-slate-100">
          {visibleItems.map((item, index) => (
            <li key={item.id ?? `${item.type ?? "evidence"}-${index}`} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.type ? <Badge tone="slate">{humanizeToken(item.type)}</Badge> : null}
                    <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                  </div>
                  {item.excerpt ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.excerpt}</p>
                  ) : null}
                  {item.detail ? (
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
                  ) : null}
                </div>
                {typeof item.confidence === "number" ? (
                  <ConfidenceBadge confidence={item.confidence} showValue={false} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-sm text-slate-500">{emptyText}</p>
      )}
      {remainingCount ? (
        <div className="border-t border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500">
          +{remainingCount} more evidence {remainingCount === 1 ? "ref" : "refs"}
        </div>
      ) : null}
    </div>
  );
}

export type ConfidenceBadgeProps = {
  confidence?: number | null;
  label?: string;
  showValue?: boolean;
  className?: string;
};

export function ConfidenceBadge({
  confidence,
  label,
  showValue = true,
  className,
}: ConfidenceBadgeProps) {
  const percent = normalizePercent(confidence);
  const level = getConfidenceLevel(percent);
  const text = label ?? formatConfidenceLabel(level);
  const valueText = percent === null || !showValue ? "" : ` ${Math.round(percent)}%`;

  return (
    <Badge tone={confidenceTone(level)} className={className}>
      {text}
      {valueText}
    </Badge>
  );
}

export type CalibrationSeverity = "none" | "low" | "medium" | "high";

export type CalibrationResultItem = {
  id?: string;
  label: string;
  humanScore?: number | null;
  judgeScore?: number | null;
  scoreDelta?: number | null;
  severity?: CalibrationSeverity;
  reviewStatus?: string;
};

export type CalibrationSummaryPanelProps = {
  agreement?: number | null;
  totalLabels?: number;
  disagreementCount?: number;
  status?: "healthy" | "review" | "low_agreement" | "stale" | string;
  title?: string;
  description?: string;
  lastCalibratedAt?: string | null;
  nextReviewLabel?: string;
  results?: readonly CalibrationResultItem[];
  maxResults?: number;
  emptyText?: string;
  className?: string;
};

export function CalibrationSummaryPanel({
  agreement,
  totalLabels = 0,
  disagreementCount = 0,
  status = "review",
  title = "Judge calibration",
  description = "Agreement against human labels and the highest-priority disagreements for review.",
  lastCalibratedAt,
  nextReviewLabel,
  results = [],
  maxResults = 4,
  emptyText = "No calibration disagreements queued.",
  className,
}: CalibrationSummaryPanelProps) {
  const agreementPercent = normalizePercent(agreement);
  const agreementValue = agreementPercent ?? 0;
  const visibleResults = results.slice(0, Math.max(0, maxResults));
  const hiddenResults = Math.max(0, results.length - visibleResults.length);

  return (
    <Card className={cn("p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <Badge tone={calibrationStatusTone(status)}>{humanizeToken(status)}</Badge>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <MetricTile label="Agreement" value={formatOptionalPercent(agreementPercent)} />
        <MetricTile label="Human labels" value={formatInteger(totalLabels)} />
        <MetricTile label="Disagreements" value={formatInteger(disagreementCount)} />
        <MetricTile label="Last calibrated" value={formatDateLabel(lastCalibratedAt)} />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">Agreement quality</span>
          <strong className="text-slate-950">{formatOptionalPercent(agreementPercent)}</strong>
        </div>
        <ProgressBar value={agreementValue} tone={agreementTone(agreementValue)} />
      </div>

      {nextReviewLabel ? (
        <div className="mt-4 rounded-[8px] bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 ring-1 ring-blue-100">
          Next review: {nextReviewLabel}
        </div>
      ) : null}

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-950">Disagreement review</h3>
        {visibleResults.length ? (
          <ul className="mt-3 divide-y divide-slate-100 rounded-[8px] border border-slate-200">
            {visibleResults.map((result, index) => (
              <li key={result.id ?? `${result.label}-${index}`} className="px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">{result.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Human {formatScore(result.humanScore)} - Judge {formatScore(result.judgeScore)}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge tone={severityTone(result.severity)}>
                      {formatDelta(result)}
                    </Badge>
                    {result.reviewStatus ? (
                      <Badge tone="slate">{humanizeToken(result.reviewStatus)}</Badge>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-[8px] border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
            {emptyText}
          </p>
        )}
        {hiddenResults ? (
          <p className="mt-3 text-xs font-semibold text-slate-500">
            +{hiddenResults} more calibration {hiddenResults === 1 ? "result" : "results"}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function normalizePercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const percent = value > 1 ? value : value * 100;
  return Math.max(0, Math.min(100, percent));
}

function getConfidenceLevel(percent: number | null) {
  if (percent === null) return "unknown";
  if (percent >= 80) return "high";
  if (percent >= 60) return "medium";
  return "low";
}

function formatConfidenceLabel(level: string) {
  if (level === "high") return "High confidence";
  if (level === "medium") return "Medium confidence";
  if (level === "low") return "Low confidence";
  return "Confidence not specified";
}

function confidenceTone(level: string): Tone {
  if (level === "high") return "green";
  if (level === "medium") return "amber";
  if (level === "low") return "red";
  return "slate";
}

function agreementTone(percent: number): Tone {
  if (percent >= 80) return "green";
  if (percent >= 70) return "amber";
  return "red";
}

function calibrationStatusTone(status: string): Tone {
  if (status === "healthy") return "green";
  if (status === "low_agreement" || status === "stale") return "amber";
  if (status === "review") return "blue";
  return "slate";
}

function severityTone(severity: CalibrationSeverity | undefined): Tone {
  if (severity === "high") return "red";
  if (severity === "medium" || severity === "low") return "amber";
  if (severity === "none") return "green";
  return "slate";
}

function formatEvidenceCount(count: number) {
  if (count === 0) return "No evidence refs";
  if (count === 1) return "1 evidence ref";
  return `${count} evidence refs`;
}

function formatOptionalPercent(percent: number | null) {
  return percent === null ? "Not scored" : `${Math.round(percent)}%`;
}

function formatInteger(value: number) {
  return Number.isFinite(value) ? String(Math.max(0, Math.round(value))) : "0";
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "Not calibrated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not calibrated";

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatScore(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value).toString() : "n/a";
}

function formatDelta(result: CalibrationResultItem) {
  const delta =
    typeof result.scoreDelta === "number" && Number.isFinite(result.scoreDelta)
      ? result.scoreDelta
      : calculateDelta(result.humanScore, result.judgeScore);
  const roundedDelta = Math.round(delta ?? 0);
  return `${roundedDelta} pt ${roundedDelta === 1 ? "delta" : "delta"}`;
}

function calculateDelta(
  humanScore: number | null | undefined,
  judgeScore: number | null | undefined,
) {
  if (
    typeof humanScore !== "number" ||
    typeof judgeScore !== "number" ||
    !Number.isFinite(humanScore) ||
    !Number.isFinite(judgeScore)
  ) {
    return null;
  }

  return Math.abs(humanScore - judgeScore);
}

function humanizeToken(value: string) {
  const cleaned = value.replace(/[_-]+/g, " ").trim().toLocaleLowerCase();
  return cleaned ? cleaned.charAt(0).toLocaleUpperCase() + cleaned.slice(1) : value;
}
