import type { EvallerReadinessReportRecord, EvallerRunDetail } from "./types";

export type EvallerReadinessStatus =
  | "Ready for release review"
  | "Improved, needs follow-up"
  | "Not ready";

export type EvallerReadinessReport = {
  status: EvallerReadinessStatus;
  summary: string;
  appliedPromptChange: string;
  remainingRisks: string[];
  recommendedNextStep: string;
  copyText: string;
};

export function buildReadinessReport(run: EvallerRunDetail): EvallerReadinessReport {
  const delta = run.previousRun ? round(run.passRate - run.previousRun.passRate) : null;
  const status = readinessStatus(run, delta);
  const remainingRisks = collectRemainingRisks(run);
  const summary = buildSummary(run, delta);
  const recommendedNextStep = nextStepFor(status);
  const appliedPromptChange = run.promptVersionLabel;

  return {
    status,
    summary,
    appliedPromptChange,
    remainingRisks,
    recommendedNextStep,
    copyText: [
      "AI Release Readiness Report",
      `Status: ${status}`,
      `Summary: ${summary}`,
      `Before/after pass rate: ${formatBeforeAfter(run)}`,
      `Prompt: ${appliedPromptChange}`,
      "Remaining risks:",
      ...remainingRisks.map((risk) => `- ${risk}`),
      `Recommended next step: ${recommendedNextStep}`,
    ].join("\n"),
  };
}

export function buildReadinessReportRecord(input: {
  id: string;
  run: EvallerRunDetail;
  now: string;
}): EvallerReadinessReportRecord {
  const report = buildReadinessReport(input.run);

  return {
    id: input.id,
    organizationId: input.run.organizationId,
    aiTestId: input.run.aiTestId,
    runId: input.run.id,
    status: report.status,
    approvalStatus: "pending",
    summary: report.summary,
    beforePassRate: input.run.previousRun?.passRate,
    afterPassRate: input.run.passRate,
    appliedPromptChange: report.appliedPromptChange,
    remainingRisks: report.remainingRisks,
    recommendedNextStep: report.recommendedNextStep,
    copyText: report.copyText,
    copyCount: 0,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function readinessStatus(run: EvallerRunDetail, delta: number | null): EvallerReadinessStatus {
  if (run.failedScenarios === 0) return "Ready for release review";
  if (delta !== null && delta > 0) return "Improved, needs follow-up";
  return "Not ready";
}

function buildSummary(run: EvallerRunDetail, delta: number | null) {
  const base = `${formatPercent(run.passRate)} pass rate across ${run.totalScenarios} scenario${run.totalScenarios === 1 ? "" : "s"}`;
  if (delta !== null) {
    return `${base}, ${delta >= 0 ? "up" : "down"} ${formatPercent(Math.abs(delta))} from the previous run.`;
  }
  return `${base} with ${run.failedScenarios} still failing.`;
}

function formatBeforeAfter(run: EvallerRunDetail) {
  if (run.previousRun) {
    const delta = round(run.passRate - run.previousRun.passRate);
    return `${formatPercent(run.previousRun.passRate)} before, ${formatPercent(run.passRate)} after (${delta >= 0 ? "+" : ""}${formatPercent(delta)}).`;
  }
  return `${formatPercent(run.passRate)} baseline.`;
}

function collectRemainingRisks(run: EvallerRunDetail) {
  const failedResultRisks = run.results
    .filter((result) => result.status === "failed")
    .map((result) => {
      const criteria = result.failedCriteria.length
        ? result.failedCriteria.join("; ")
        : "Scenario did not meet the configured quality bar";
      return `${result.scenarioTitle}: ${criteria}`;
    });

  const failurePatternRisks = run.failurePatterns
    .filter((pattern) => !failedResultRisks.some((risk) => risk.includes(pattern.failedCriteria.join("; "))))
    .map((pattern) => pattern.title);

  const risks = Array.from(new Set([...failedResultRisks, ...failurePatternRisks]));
  return risks.length ? risks : ["No open scenario failures in the latest run."];
}

function nextStepFor(status: EvallerReadinessStatus) {
  if (status === "Ready for release review") {
    return "Use this prompt as the release candidate and keep these scenarios as regression checks.";
  }
  if (status === "Improved, needs follow-up") {
    return "Review the remaining failed scenarios and add one targeted prompt rule before release.";
  }
  return "Apply the highest-impact prompt fix, then rerun before release review.";
}

function formatPercent(value: number) {
  return `${round(value)}%`;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
