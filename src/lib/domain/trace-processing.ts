import { parse as parseCsv } from "csv-parse/sync";
import type { EvalCase, RiskLevel } from "./audit";

export type TraceSourceType = "CSV" | "JSON" | "NDJSON" | "TXT";
export type EvalSet = "golden" | "regression" | "edge" | "safety";
export type IssueStatus = "open" | "resolved" | "ignored" | "reopened";
export type IssueSeverity = "low" | "medium" | "high";

export type NormalizedTrace = {
  externalId: string;
  sourceType: TraceSourceType;
  input: string;
  output: string;
  redactedInput: string;
  redactedOutput: string;
  redactionHits: string[];
  intent: string;
  riskLevel: RiskLevel;
  occurredAt: string;
  metadata: Record<string, unknown>;
};

export type ReviewIssue = {
  id: string;
  evalCaseId: string;
  title: string;
  severity: IssueSeverity;
  status: IssueStatus;
  description: string;
};

export type GeneratedArtifacts = {
  evalCases: EvalCase[];
  issues: ReviewIssue[];
  graders: Array<{
    id: string;
    name: string;
    type: "deterministic" | "llm_judge";
    description: string;
    health: "healthy" | "low_agreement" | "review";
    agreement: number;
    model?: string;
  }>;
  report: {
    summary: string;
    readinessScore: number;
    recommendations: string[];
  };
};

type ParseTraceFileInput = {
  fileName: string;
  contentType: string;
  text: string;
};

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?:\+?\d[\s.-]?){9,15}/g;
const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g;
const SECRET_RE = /\b(?:sk|rk|pk|api|token)[-_][A-Za-z0-9_-]{10,}\b/g;

export function redactSensitiveText(text: string) {
  const hits: string[] = [];
  let redacted = text;

  const replace = (name: string, pattern: RegExp, token: string) => {
    if (pattern.test(redacted)) {
      hits.push(name);
      redacted = redacted.replace(pattern, token);
    }
  };

  replace("secret", SECRET_RE, "[secret]");
  replace("email", EMAIL_RE, "[email]");
  replace("card", CARD_RE, "[card]");
  replace("phone", PHONE_RE, "[phone]");

  return { text: redacted, hits: Array.from(new Set(hits)) };
}

export function parseTraceFile(input: ParseTraceFileInput): NormalizedTrace[] {
  const sourceType = inferSourceType(input.fileName, input.contentType);
  const rows =
    sourceType === "CSV"
      ? parseCsvRows(input.text)
      : sourceType === "JSON"
        ? parseJsonRows(input.text)
        : sourceType === "NDJSON"
          ? parseNdjsonRows(input.text)
          : parseTextRows(input.text);

  if (rows.length === 0) {
    throw new Error("No trace rows were found in the uploaded file.");
  }

  return rows.map((row, index) => normalizeTraceRow(row, index, sourceType));
}

function inferSourceType(fileName: string, contentType: string): TraceSourceType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv") || contentType.includes("csv")) return "CSV";
  if (lower.endsWith(".ndjson") || contentType.includes("x-ndjson")) return "NDJSON";
  if (lower.endsWith(".json") || contentType.includes("json")) return "JSON";
  if (lower.endsWith(".txt") || contentType.startsWith("text/")) return "TXT";
  throw new Error("Unsupported file type. Upload CSV, JSON, NDJSON, or TXT files.");
}

function parseCsvRows(text: string): Record<string, unknown>[] {
  return parseCsv(text, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];
}

function parseJsonRows(text: string): Record<string, unknown>[] {
  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
  if (parsed && typeof parsed === "object") {
    const object = parsed as Record<string, unknown>;
    if (Array.isArray(object.traces)) return object.traces as Record<string, unknown>[];
    if (Array.isArray(object.rows)) return object.rows as Record<string, unknown>[];
    if (Array.isArray(object.messages)) return [object];
  }
  throw new Error("JSON trace files must be an array or contain traces, rows, or messages.");
}

function parseNdjsonRows(text: string): Record<string, unknown>[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function parseTextRows(text: string): Record<string, unknown>[] {
  return text
    .split(/\n\s*\n/)
    .map((block, index) => {
      const userMatch = block.match(/(?:^|\n)\s*(?:user|human|prompt)\s*:\s*([\s\S]+?)(?=\n\s*(?:assistant|ai|output)\s*:|$)/i);
      const assistantMatch = block.match(/(?:^|\n)\s*(?:assistant|ai|output)\s*:\s*([\s\S]+)$/i);
      return {
        id: `text_${index + 1}`,
        input: userMatch?.[1]?.trim() || block.trim(),
        output: assistantMatch?.[1]?.trim() || "",
      };
    })
    .filter((row) => String(row.input).trim().length > 0);
}

function normalizeTraceRow(
  row: Record<string, unknown>,
  index: number,
  sourceType: TraceSourceType,
): NormalizedTrace {
  const input = pickString(row, [
    "user_input",
    "input",
    "prompt",
    "user",
    "content",
    "question",
    "request",
  ]);
  const output = pickString(row, [
    "assistant_output",
    "output",
    "response",
    "assistant",
    "answer",
    "completion",
  ]);
  const messages = Array.isArray(row.messages) ? row.messages : [];
  const derivedInput =
    input ||
    messages
      .filter((message) => getObjectString(message, "role") !== "assistant")
      .map((message) => getObjectString(message, "content"))
      .filter(Boolean)
      .join("\n");
  const derivedOutput =
    output ||
    messages
      .filter((message) => getObjectString(message, "role") === "assistant")
      .map((message) => getObjectString(message, "content"))
      .filter(Boolean)
      .join("\n");

  if (!derivedInput.trim()) {
    throw new Error(`Trace row ${index + 1} is missing user input or prompt content.`);
  }

  const redactedInput = redactSensitiveText(derivedInput);
  const redactedOutput = redactSensitiveText(derivedOutput);
  const intent = inferIntent(derivedInput, derivedOutput);

  return {
    externalId: pickString(row, ["conversation_id", "trace_id", "id"]) || `row_${index + 1}`,
    sourceType,
    input: derivedInput,
    output: derivedOutput,
    redactedInput: redactedInput.text,
    redactedOutput: redactedOutput.text,
    redactionHits: Array.from(new Set([...redactedInput.hits, ...redactedOutput.hits])),
    intent,
    riskLevel: inferRisk(intent, derivedInput, derivedOutput),
    occurredAt:
      pickString(row, ["timestamp", "created_at", "occurred_at"]) || new Date().toISOString(),
    metadata: row,
  };
}

function pickString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function getObjectString(value: unknown, key: string) {
  if (!value || typeof value !== "object") return "";
  const found = (value as Record<string, unknown>)[key];
  return typeof found === "string" ? found : "";
}

function inferIntent(input: string, output: string) {
  const text = `${input} ${output}`.toLowerCase();
  if (/(bill|invoice|charge|payment|subscription|card)/.test(text)) return "Billing";
  if (/(refund|chargeback|money back)/.test(text)) return "Refunds";
  if (/(delete|privacy|data request|gdpr|ccpa)/.test(text)) return "Privacy";
  if (/(human|manager|escalat|angry|frustrat|asked three times|not fixed)/.test(text)) {
    return "Escalation";
  }
  if (/(login|password|account|access)/.test(text)) return "Account Access";
  if (/(bug|error|outage|technical|broken)/.test(text)) return "Technical Support";
  if (/(feature|docs|how do i|can your)/.test(text)) return "Product Support";
  return "General Support";
}

function inferRisk(intent: string, input: string, output: string): RiskLevel {
  const text = `${input} ${output}`.toLowerCase();
  if (intent === "Escalation" || intent === "Privacy" || /(legal|lawsuit|unsafe|delete all)/.test(text)) {
    return "high";
  }
  if (intent === "Billing" || intent === "Refunds" || intent === "Technical Support") return "medium";
  return "low";
}

export function buildEvalArtifacts({
  projectId,
  traces,
}: {
  projectId: string;
  traces: NormalizedTrace[];
}): GeneratedArtifacts {
  const evalCases = traces.slice(0, 50).map((trace, index) => {
    const set = inferEvalSet(trace);
    const criteria = criteriaForIntent(trace.intent);
    const score = scoreTrace(trace);
    return {
      id: makeStableId("case", projectId, trace.externalId, index),
      name: `${trace.intent} - ${trace.redactedInput.slice(0, 48)}`,
      set,
      intent: trace.intent,
      source: "production",
      risk: trace.riskLevel,
      grader: "Deterministic rubric",
      lastResult: score,
      status: score >= 70 ? "passed" : score >= 50 ? "review" : "failed",
      userInput: trace.redactedInput,
      expectedBehavior: expectedBehaviorForIntent(trace.intent),
      acceptanceCriteria: criteria,
    } satisfies EvalCase;
  });

  const issues = evalCases
    .flatMap((evalCase, index) => issueForCase(evalCase, traces[index]))
    .map((issue, index) => ({
      ...issue,
      id: makeStableId("issue", projectId, issue.evalCaseId, index),
    }));

  const passRate =
    evalCases.length === 0
      ? 0
      : Math.round((evalCases.filter((item) => item.status === "passed").length / evalCases.length) * 100);

  return {
    evalCases,
    issues,
    graders: [
      {
        id: makeStableId("grader", projectId, "deterministic-rubric"),
        name: "Deterministic rubric",
        type: "deterministic",
        description: "Checks intent-specific acceptance criteria against redacted assistant output.",
        health: passRate >= 70 ? "healthy" : "review",
        agreement: Math.max(0.55, Math.min(0.96, passRate / 100)),
      },
      {
        id: makeStableId("grader", projectId, "policy-judge"),
        name: "Policy Compliance Judge",
        type: "llm_judge",
        description: "Ready for OpenAI Responses API structured judge scoring when credentials are enabled.",
        health: "review",
        agreement: 0.72,
        model: "gpt-4.1-mini",
      },
    ],
    report: {
      summary: `${traces.length} trace${traces.length === 1 ? "" : "s"} processed with ${passRate}% deterministic pass rate and ${issues.length} open issue${issues.length === 1 ? "" : "s"}.`,
      readinessScore: Math.max(0, Math.min(100, Math.round(passRate - issues.length * 4))),
      recommendations: buildRecommendations(evalCases, issues),
    },
  };
}

function inferEvalSet(trace: NormalizedTrace): EvalSet {
  if (trace.intent === "Privacy") return "safety";
  if (trace.riskLevel === "high") return "regression";
  if (trace.riskLevel === "medium") return "golden";
  return "edge";
}

function criteriaForIntent(intent: string) {
  if (intent === "Escalation") return ["Acknowledges frustration", "Creates or offers human handoff"];
  if (intent === "Refunds") return ["Verifies refund context", "Explains refund timing", "Avoids unsupported policy claims"];
  if (intent === "Billing") return ["Identifies billing concern", "Uses safe account confirmation", "Explains next step clearly"];
  if (intent === "Privacy") return ["Identifies privacy request", "Requires confirmation", "Avoids irreversible action without review"];
  if (intent === "Technical Support") return ["Checks current status", "Gives actionable remediation", "Escalates live incidents"];
  return ["Answers from provided context", "Avoids unsupported claims", "Keeps response concise"];
}

function expectedBehaviorForIntent(intent: string) {
  return `${intent} responses should satisfy the acceptance criteria, avoid unsupported claims, and preserve user trust.`;
}

function scoreTrace(trace: NormalizedTrace) {
  const output = trace.output.toLowerCase();
  if (!output.trim()) return 20;
  let score = 78;
  if (trace.riskLevel === "high") score -= 18;
  if (trace.intent === "Escalation" && !/(human|agent|handoff|escalat|ticket)/.test(output)) score -= 35;
  if ((trace.intent === "Billing" || trace.intent === "Refunds") && !/(refund|charge|invoice|billing|confirm)/.test(output)) score -= 22;
  if (trace.intent === "Privacy" && !/(confirm|privacy|delete|request|support)/.test(output)) score -= 35;
  if (/(sorry|understand|help|confirm|check)/.test(output)) score += 8;
  return Math.max(0, Math.min(100, score));
}

function issueForCase(evalCase: EvalCase, trace: NormalizedTrace): Omit<ReviewIssue, "id">[] {
  if (evalCase.status === "passed") return [];
  const output = trace.output.toLowerCase();
  if (evalCase.intent === "Escalation" && !/(human|agent|handoff|escalat|ticket)/.test(output)) {
    return [
      {
        evalCaseId: evalCase.id,
        title: "Escalation handoff missing",
        severity: "high",
        status: "open",
        description: "High-frustration user input did not receive a human handoff or escalation path.",
      },
    ];
  }
  if (!trace.output.trim()) {
    return [
      {
        evalCaseId: evalCase.id,
        title: "Assistant output missing",
        severity: evalCase.risk === "high" ? "high" : "medium",
        status: "open",
        description: "Trace did not include an assistant output, so the case requires reviewer attention.",
      },
    ];
  }
  return [
    {
      evalCaseId: evalCase.id,
      title: `${evalCase.intent} acceptance criteria not met`,
      severity: evalCase.risk === "high" ? "high" : "medium",
      status: "open",
      description: "Deterministic review found one or more missing acceptance criteria.",
    },
  ];
}

function buildRecommendations(evalCases: EvalCase[], issues: ReviewIssue[]) {
  const intents = Array.from(new Set(issues.map((issue) => evalCases.find((item) => item.id === issue.evalCaseId)?.intent).filter(Boolean)));
  if (issues.length === 0) return ["Run a broader regression import to increase confidence."];
  return intents.map((intent) => `Review ${intent} eval coverage and add acceptance criteria for the open issue cluster.`);
}

export function buildCsvExport({
  evalCases,
  issues,
}: {
  evalCases: EvalCase[];
  issues: ReviewIssue[];
}) {
  const rows = [
    ["case_id", "name", "set", "intent", "risk", "status", "last_result", "open_issues"],
    ...evalCases.map((evalCase) => [
      evalCase.id,
      evalCase.name,
      evalCase.set,
      evalCase.intent,
      evalCase.risk,
      evalCase.status,
      String(evalCase.lastResult),
      String(issues.filter((issue) => issue.evalCaseId === evalCase.id && issue.status === "open").length),
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function makeStableId(prefix: string, ...parts: Array<string | number>) {
  const value = parts.join(":");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `${prefix}_${hash.toString(16).padStart(8, "0")}`;
}
