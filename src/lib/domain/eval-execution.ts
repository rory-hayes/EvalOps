import type { EvidenceRef } from "./audit";
import type { StoredEvalCase, StoredEvalResult, StoredGrader, StoredTrace } from "@/lib/server/types";

export type ExecuteDeterministicGraderInput = {
  evalCase: StoredEvalCase;
  grader: StoredGrader;
  trace?: StoredTrace;
  evalRunId: string;
  promptVersionId?: string;
  now?: string | Date;
};

export type BuildEvalExecutionResultInput = ExecuteDeterministicGraderInput & {
  score: number;
  status?: StoredEvalResult["status"];
  rationale: string;
  evidenceRefs?: EvidenceRef[];
  model?: string;
  latencyMs?: number;
  estimatedCost?: number;
  tokenUsage?: Record<string, unknown>;
  confidence?: number;
};

export type EvalResultSummary = {
  totalCases: number;
  failedCases: number;
  reviewCases: number;
  passRate: number;
  averageScore: number;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "should",
  "the",
  "to",
  "with",
]);

const TOKEN_SYNONYMS: Record<string, string[]> = {
  acknowledg: ["understand", "sorry", "apologize", "apology", "recognize", "hear", "empathize"],
  billing: ["bill", "invoice", "charge", "payment", "subscription"],
  claim: ["statement", "promise", "guarantee"],
  confirm: ["verify", "check", "validate"],
  create: ["open", "raise", "submit", "start", "route"],
  escalat: ["human", "agent", "manager", "representative", "handoff", "ticket"],
  frustrat: ["upset", "angry", "difficult", "sorry", "understand"],
  handoff: ["human", "agent", "manager", "representative", "escalat", "ticket", "specialist"],
  human: ["agent", "manager", "representative", "person", "specialist", "handoff"],
  offer: ["provide", "route", "can", "available"],
  refund: ["credit", "money"],
  request: ["ask", "case", "ticket"],
  review: ["human", "agent", "manager", "confirm"],
  unsupported: ["unverified", "cannot", "can't", "provided", "context"],
};

export function executeDeterministicGrader(input: ExecuteDeterministicGraderInput): StoredEvalResult {
  const redactedOutput = getRedactedTraceOutput(input.trace);
  const criteria = input.evalCase.acceptanceCriteria;
  const matches = criteria.map((criterion) => ({
    criterion,
    matched: criterionMatchesOutput(criterion, redactedOutput),
  }));
  const matchedCount = matches.filter((match) => match.matched).length;
  const score = criteria.length === 0 ? 0 : Math.round((matchedCount / criteria.length) * 100);
  const missing = matches.filter((match) => !match.matched).map((match) => match.criterion);
  const rationale = [
    `Matched ${matchedCount} of ${criteria.length} acceptance criteria using redacted trace output.`,
    missing.length ? `Missing: ${missing.join("; ")}.` : "All configured criteria were satisfied.",
  ].join(" ");

  return buildEvalExecutionResult({
    ...input,
    score,
    rationale,
  });
}

export function summarizeEvalResults(
  results: Array<Pick<StoredEvalResult, "status" | "score">>,
): EvalResultSummary {
  if (results.length === 0) {
    return {
      totalCases: 0,
      failedCases: 0,
      reviewCases: 0,
      passRate: 0,
      averageScore: 0,
    };
  }

  const passedCases = results.filter((result) => result.status === "passed").length;
  const failedCases = results.filter((result) => result.status === "failed").length;
  const reviewCases = results.filter((result) => result.status === "review").length;
  const scoreTotal = results.reduce((total, result) => total + result.score, 0);

  return {
    totalCases: results.length,
    failedCases,
    reviewCases,
    passRate: roundToTenth((passedCases / results.length) * 100),
    averageScore: roundToTenth(scoreTotal / results.length),
  };
}

export function buildEvalExecutionResult(input: BuildEvalExecutionResultInput): StoredEvalResult {
  const score = clampScore(input.score);
  const createdAt = toIsoString(input.now);

  return {
    id: makeStableId(
      "eval_result",
      input.evalRunId,
      input.evalCase.id,
      input.grader.id,
      input.promptVersionId || "current",
    ),
    organizationId: input.evalCase.organizationId,
    projectId: input.evalCase.projectId,
    evalRunId: input.evalRunId,
    evalCaseId: input.evalCase.id,
    status: input.status || resolveEvalStatus(score, input.grader),
    score,
    graderId: input.grader.id,
    rationale: input.rationale,
    evidenceRefs: input.evidenceRefs || buildDefaultEvidenceRefs(input.evalCase, input.trace),
    promptVersionId: input.promptVersionId,
    model: input.model,
    latencyMs: input.latencyMs,
    estimatedCost: input.estimatedCost,
    tokenUsage: input.tokenUsage,
    confidence: input.confidence,
    createdAt,
  };
}

export function resolveEvalStatus(score: number, grader: Pick<StoredGrader, "passThreshold" | "reviewThreshold">) {
  const normalizedScore = clampScore(score);
  if (normalizedScore >= thresholdToScore(grader.passThreshold)) return "passed";
  if (normalizedScore >= thresholdToScore(grader.reviewThreshold)) return "review";
  return "failed";
}

export function getRedactedTraceInput(trace: StoredTrace) {
  return trace.redactedInput || "";
}

export function getRedactedTraceOutput(trace?: StoredTrace) {
  return trace?.redactedOutput || "";
}

function buildDefaultEvidenceRefs(evalCase: StoredEvalCase, trace?: StoredTrace): EvidenceRef[] {
  const traceExcerpt = truncateForEvidence(getRedactedTraceOutput(trace));
  const refs: EvidenceRef[] = [
    {
      entityType: "eval_case",
      entityId: evalCase.id,
      label: `${evalCase.name} acceptance criteria`,
      excerpt: truncateForEvidence(evalCase.acceptanceCriteria.join("; ")),
    },
  ];
  if (trace) {
    refs.push({
      entityType: "trace",
      entityId: trace.id,
      label: "Redacted assistant output",
      ...(traceExcerpt ? { excerpt: traceExcerpt } : {}),
    });
  }
  return refs;
}

function criterionMatchesOutput(criterion: string, output: string) {
  const normalizedOutput = normalizeText(output);
  if (!normalizedOutput) return false;

  const normalizedCriterion = normalizeText(criterion);
  if (normalizedCriterion && normalizedOutput.includes(normalizedCriterion)) return true;

  const criterionTokens = meaningfulTokens(criterion);
  if (criterionTokens.length === 0) return false;

  const outputTokens = new Set(meaningfulTokens(output));
  const matchedTokens = criterionTokens.filter((token) => tokenMatchesOutput(token, outputTokens, normalizedOutput));
  return matchedTokens.length / criterionTokens.length >= 0.5;
}

function tokenMatchesOutput(token: string, outputTokens: Set<string>, normalizedOutput: string) {
  if (outputTokens.has(token)) return true;
  return (TOKEN_SYNONYMS[token] || []).some((synonym) => {
    const normalizedSynonym = normalizeToken(synonym);
    return outputTokens.has(normalizedSynonym) || normalizedOutput.includes(normalizedSynonym);
  });
}

function meaningfulTokens(value: string) {
  return value
    .toLowerCase()
    .match(/[a-z0-9']+/g)?.map(normalizeToken)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)) || [];
}

function normalizeText(value: string) {
  return meaningfulTokens(value).join(" ");
}

function normalizeToken(value: string) {
  const token = value.toLowerCase().replace(/^'+|'+$/g, "");
  if (token.startsWith("acknowledg")) return "acknowledg";
  if (token.startsWith("escalat")) return "escalat";
  if (token.startsWith("frustrat")) return "frustrat";
  if (token.endsWith("ies") && token.length > 5) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ing") && token.length > 6) return token.slice(0, -3);
  if (token.endsWith("ed") && token.length > 5) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 4) return token.slice(0, -1);
  return token;
}

function thresholdToScore(value: number) {
  return clampScore(value * 100);
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}

function truncateForEvidence(value: string, maxLength = 240) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3)}...`;
}

function toIsoString(now?: string | Date) {
  if (!now) return new Date().toISOString();
  return typeof now === "string" ? now : now.toISOString();
}

function makeStableId(prefix: string, ...parts: Array<string | number>) {
  const value = parts.join(":");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `${prefix}_${hash.toString(16).padStart(8, "0")}`;
}
