import type { EvalCase, Grader, TraceImport } from "@/lib/domain/audit";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  CircleDollarSign,
  ClipboardCheck,
  Database,
  FileJson,
  FileText,
  Headphones,
  LockKeyhole,
  Route,
  Scale,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Wrench,
} from "lucide-react";

export const project = {
  name: "Support Assistant v2",
  initials: "SA",
  owner: "Alex Morgan",
  promptVersion: "v3.7.2",
  modelMix: ["70% GPT-4o", "20% Claude 3.5", "10% Gemini 1.5"],
  dataset: "Production (1.2k)",
  lastRun: "May 19, 2025 10:24 AM",
  dateRange: "May 12 - May 19, 2025",
};

export const navItems = [
  { label: "Dashboard", href: "/", icon: BarChart3 },
  { label: "Projects", href: "/projects", icon: FileText },
  { label: "Trace Import", href: "/trace-import", icon: UploadCloud },
  { label: "Eval Builder", href: "/eval-builder", icon: Sparkles },
  { label: "Graders", href: "/graders", icon: ShieldCheck },
  { label: "Prompt Optimizer", href: "/prompt-optimizer", icon: Wrench },
  { label: "Routing & Caching", href: "/routing-caching", icon: Route },
  { label: "Reports", href: "/reports", icon: ClipboardCheck },
  { label: "Settings", href: "/settings", icon: LockKeyhole },
];

export const healthMetrics = [
  {
    label: "Intent Coverage",
    value: "92.6%",
    delta: "+3.7 pp vs May 5 - May 11",
    color: "emerald",
    tone: "good",
    sparkline: [56, 61, 58, 63, 60, 62, 59, 61, 57, 53, 55, 52, 54, 53, 57, 56, 59, 55, 57],
    icon: ShieldCheck,
  },
  {
    label: "Regression Safety",
    value: "96.1%",
    delta: "+1.8 pp vs May 5 - May 11",
    color: "violet",
    tone: "good",
    sparkline: [61, 55, 59, 57, 60, 62, 63, 58, 57, 54, 52, 55, 55, 58, 59, 60, 56, 54, 62],
    icon: ShieldCheck,
  },
  {
    label: "Judge Calibration",
    value: "0.92",
    delta: "+0.06 vs May 5 - May 11",
    color: "blue",
    tone: "good",
    sparkline: [65, 58, 57, 61, 59, 62, 58, 56, 55, 54, 56, 58, 57, 60, 62, 61, 66, 60, 64],
    icon: Scale,
  },
  {
    label: "Cost Efficiency",
    value: "$0.021 / turn",
    delta: "-8.4% vs May 5 - May 11",
    color: "orange",
    tone: "warn",
    sparkline: [70, 60, 66, 62, 63, 58, 61, 57, 58, 54, 50, 47, 45, 42, 44, 39, 40, 36, 35],
    icon: CircleDollarSign,
  },
  {
    label: "Stale Eval Risk",
    value: "High",
    delta: "+ from Medium",
    color: "red",
    tone: "danger",
    sparkline: [42, 56, 62, 59, 64, 61, 50, 48, 56, 54, 59, 60, 63, 51, 50, 48, 45, 51, 43],
    icon: AlertTriangle,
  },
];

export const passRateSeries = [
  { day: "May 12", overall: 94, support: 76, billing: 69, refunds: 56 },
  { day: "May 13", overall: 93, support: 83, billing: 73, refunds: 57 },
  { day: "May 14", overall: 97, support: 86, billing: 72, refunds: 62 },
  { day: "May 15", overall: 95, support: 88, billing: 74, refunds: 64 },
  { day: "May 16", overall: 93, support: 83, billing: 73, refunds: 66 },
  { day: "May 17", overall: 94, support: 84, billing: 76, refunds: 60 },
  { day: "May 18", overall: 96, support: 87, billing: 80, refunds: 68 },
  { day: "May 19", overall: 96, support: 87, billing: 77, refunds: 67 },
];

export const coverageByIntent = [
  { intent: "Account Access", covered: 72, partial: 20, missing: 4, total: 96 },
  { intent: "Product Support", covered: 76, partial: 16, missing: 1, total: 93 },
  { intent: "Billing Inquiry", covered: 78, partial: 12, missing: 0, total: 90 },
  { intent: "Refund Request", covered: 67, partial: 11, missing: 0, total: 78 },
  { intent: "Technical Issue", covered: 62, partial: 6, missing: 6, total: 74 },
  { intent: "Order Status", covered: 55, partial: 3, missing: 10, total: 68 },
  { intent: "Escalation", covered: 42, partial: 5, missing: 5, total: 52 },
  { intent: "Fraud Report", covered: 29, partial: 10, missing: 0, total: 39 },
];

export const failureClusters = [
  { label: "Incorrect refund eligibility determination", runs: 312, percent: "23.1%", tone: "red" },
  { label: "Missed escalation for high-frustration users", runs: 201, percent: "14.9%", tone: "orange" },
  { label: "Hallucinated policy or feature details", runs: 178, percent: "13.2%", tone: "amber" },
  { label: "Incorrect billing amount or date", runs: 142, percent: "10.5%", tone: "violet" },
  { label: "Poor tool selection for account actions", runs: 98, percent: "7.3%", tone: "blue" },
];

export const evalRuns = [
  { id: "run_9f3b7c1e", started: "May 19, 2025 10:24 AM", promptVersion: "v3.7.2", dataset: "Production (1.2k)", passRate: "94.3%", status: "Passed" },
  { id: "run_3d2a9b77", started: "May 18, 2025 10:21 AM", promptVersion: "v3.7.1", dataset: "Production (1.2k)", passRate: "92.1%", status: "Passed" },
  { id: "run_8a1d2f90", started: "May 17, 2025 10:18 AM", promptVersion: "v3.7.1", dataset: "Production (1.2k)", passRate: "90.4%", status: "Passed" },
  { id: "run_6c0e2a11", started: "May 16, 2025 10:16 AM", promptVersion: "v3.7.0", dataset: "Production (1.2k)", passRate: "88.7%", status: "Degraded" },
  { id: "run_5b9d8e44", started: "May 15, 2025 10:15 AM", promptVersion: "v3.6.2", dataset: "Production (1.2k)", passRate: "93.2%", status: "Passed" },
];

export const recommendedActions = [
  {
    title: "Add escalation evals",
    impact: "High impact",
    detail: "Escalation intent coverage is 52%. Add evals for high-frustration and threat signals.",
    icon: AlertTriangle,
    color: "red",
  },
  {
    title: "Recalibrate hallucination judge",
    impact: "Medium impact",
    detail: "Calibration score dropped to 0.92. Review hallucination judge thresholds and examples.",
    icon: Scale,
    color: "violet",
  },
  {
    title: "Review refund routing",
    impact: "Medium impact",
    detail: "23% of top failures are refund eligibility issues. Review routing rules and tool context.",
    icon: Route,
    color: "orange",
  },
];

export const workflowOptions = [
  {
    title: "Support Assistant",
    description: "Evaluate LLM-powered support assistants on intent handling, response quality, and escalation.",
    icon: Headphones,
    recommended: true,
  },
  {
    title: "RAG Knowledge Assistant",
    description: "Evaluate retrieval quality, context usage, and grounded answers.",
    icon: BookOpen,
    recommended: false,
  },
  {
    title: "Tool-Using Agent",
    description: "Evaluate agent behavior, tool selection, and task completion accuracy.",
    icon: Wrench,
    recommended: false,
  },
  {
    title: "Document Extraction",
    description: "Evaluate extraction accuracy, field-level precision, and completeness.",
    icon: FileJson,
    recommended: false,
  },
];

export const generatedAssets = [
  {
    title: "Intent taxonomy",
    detail: "Structured list of intents with definitions, examples, and routing labels.",
    icon: Brain,
    color: "blue",
  },
  {
    title: "Golden set",
    detail: "Curated set of real user queries labeled with intents and expected behavior.",
    icon: Database,
    color: "violet",
  },
  {
    title: "Regression set",
    detail: "Challenging queries to monitor quality over time and prevent regressions.",
    icon: BarChart3,
    color: "emerald",
  },
  {
    title: "Grader pack",
    detail: "Pre-configured graders to evaluate quality, safety, grounding, and more.",
    icon: Scale,
    color: "orange",
  },
  {
    title: "Baseline scorecard",
    detail: "Initial evaluation run that provides your starting quality benchmarks.",
    icon: ClipboardCheck,
    color: "blue",
  },
];

export const traceImports = [
  {
    id: "imp_01",
    source: "CSV",
    name: "support_logs_may19.csv",
    importedAt: "2025-05-19T10:24:00.000Z",
    traces: 1248,
    rows: 18347,
    status: "processing",
    redactionStatus: "in_progress",
    primaryIntent: "Billing Issue",
    riskLevel: "medium",
  },
  {
    id: "imp_02",
    source: "CSV",
    name: "zendesk_tickets_may18.csv",
    importedAt: "2025-05-18T09:12:00.000Z",
    traces: 944,
    rows: 6842,
    status: "completed",
    redactionStatus: "redacted",
    primaryIntent: "Refund Request",
    riskLevel: "high",
  },
  {
    id: "imp_03",
    source: "JSON",
    name: "intercom_convos_may17.json",
    importedAt: "2025-05-17T08:41:00.000Z",
    traces: 621,
    rows: 4201,
    status: "completed",
    redactionStatus: "redacted",
    primaryIntent: "Technical Issue",
    riskLevel: "medium",
  },
  {
    id: "imp_04",
    source: "NDJSON",
    name: "langfuse_export_may16.ndjson",
    importedAt: "2025-05-16T18:15:00.000Z",
    traces: 1120,
    rows: 12105,
    status: "completed",
    redactionStatus: "redacted",
    primaryIntent: "Account Access",
    riskLevel: "low",
  },
  {
    id: "imp_05",
    source: "CSV",
    name: "prompt_output_pairs_may15.csv",
    importedAt: "2025-05-15T15:53:00.000Z",
    traces: 518,
    rows: 3612,
    status: "completed",
    redactionStatus: "redacted",
    primaryIntent: "Product Support",
    riskLevel: "low",
  },
] satisfies TraceImport[];

export const importSteps = [
  { label: "Upload complete", status: "done", timestamp: "May 19, 10:24 AM" },
  { label: "Parsing & validation", status: "done", timestamp: "May 19, 10:24 AM" },
  { label: "PII detection & redaction", status: "active", timestamp: "In progress" },
  { label: "Intent inference & enrichment", status: "pending", timestamp: "Pending" },
  { label: "Indexing for evaluation", status: "pending", timestamp: "Pending" },
];

export const evalCases = [
  {
    id: "GS-1024",
    name: "Billing dispute - overcharge",
    set: "golden",
    intent: "Billing",
    source: "production",
    risk: "medium",
    grader: "Rubric v2.1",
    lastResult: 92,
    status: "passed",
    userInput:
      "I was charged $49.99 twice this month for the Pro plan. I only meant to pay once. Can you help me get a refund for the extra charge?",
    expectedBehavior:
      "The assistant confirms the duplicate charge, explains why it happened if known, apologizes, issues a refund for the extra charge, and confirms the correct balance. It also sets expectations for refund timing.",
    acceptanceCriteria: [
      "Identifies duplicate charge",
      "Apologizes and acknowledges impact",
      "Refunds the extra charge",
      "Confirms refund timing and new balance",
    ],
  },
  {
    id: "GS-1023",
    name: "Refund not received",
    set: "golden",
    intent: "Refunds",
    source: "production",
    risk: "medium",
    grader: "Rubric v2.1",
    lastResult: 78,
    status: "passed",
    userInput: "My refund still has not shown up after five business days.",
    expectedBehavior: "The assistant checks refund status, explains bank timing, and offers escalation.",
    acceptanceCriteria: ["Checks status", "Explains timing", "Offers escalation"],
  },
  {
    id: "GS-1022",
    name: "Cancel subscription",
    set: "golden",
    intent: "Account",
    source: "synthetic",
    risk: "low",
    grader: "Rubric v2.0",
    lastResult: 96,
    status: "passed",
    userInput: "Cancel my subscription at the end of the billing cycle.",
    expectedBehavior: "The assistant confirms cancellation timing and avoids deleting account data.",
    acceptanceCriteria: ["Confirms timing", "Preserves account access"],
  },
  {
    id: "GS-1021",
    name: "Incorrect charge on card",
    set: "regression",
    intent: "Billing",
    source: "production",
    risk: "high",
    grader: "Rubric v2.1",
    lastResult: 42,
    status: "failed",
    userInput: "This card charge is wrong and I need it fixed now.",
    expectedBehavior: "The assistant validates the charge, requests safe confirmation, and escalates if needed.",
    acceptanceCriteria: ["Verifies charge", "Uses safe confirmation", "Escalates high-friction cases"],
  },
  {
    id: "GS-1020",
    name: "Invoice format request",
    set: "golden",
    intent: "Billing",
    source: "synthetic",
    risk: "low",
    grader: "Rubric v2.0",
    lastResult: 88,
    status: "passed",
    userInput: "Can I get last month's invoice as a PDF?",
    expectedBehavior: "The assistant provides invoice export steps and links the billing portal.",
    acceptanceCriteria: ["Identifies invoice", "Provides PDF path"],
  },
  {
    id: "GS-1019",
    name: "Payment method update",
    set: "golden",
    intent: "Account",
    source: "production",
    risk: "low",
    grader: "Rubric v2.1",
    lastResult: 91,
    status: "passed",
    userInput: "Where do I update the credit card on file?",
    expectedBehavior: "The assistant gives a concise secure billing portal path.",
    acceptanceCriteria: ["Shares secure path", "Avoids collecting card data"],
  },
  {
    id: "GS-1018",
    name: "Escalate to human",
    set: "regression",
    intent: "Escalation",
    source: "synthetic",
    risk: "high",
    grader: "Escalation v1.3",
    lastResult: 63,
    status: "failed",
    userInput: "I have asked three times and this still is not solved.",
    expectedBehavior: "The assistant acknowledges frustration and creates a human handoff.",
    acceptanceCriteria: ["Acknowledges frustration", "Creates handoff"],
  },
  {
    id: "GS-1017",
    name: "Feature request inquiry",
    set: "edge",
    intent: "Product",
    source: "requirements",
    risk: "low",
    grader: "Rubric v2.0",
    lastResult: 82,
    status: "passed",
    userInput: "Can your assistant handle account hierarchy permissions?",
    expectedBehavior: "The assistant answers from product docs and avoids unsupported claims.",
    acceptanceCriteria: ["Grounded answer", "Avoids overclaiming"],
  },
  {
    id: "GS-1016",
    name: "Service outage question",
    set: "regression",
    intent: "Technical",
    source: "production",
    risk: "medium",
    grader: "Rubric v2.1",
    lastResult: 55,
    status: "failed",
    userInput: "Is there an outage right now?",
    expectedBehavior: "The assistant checks status source and routes live outage reports correctly.",
    acceptanceCriteria: ["Checks status source", "Routes live incidents"],
  },
  {
    id: "GS-1015",
    name: "Data deletion request",
    set: "safety",
    intent: "Privacy",
    source: "synthetic",
    risk: "high",
    grader: "Safety v1.1",
    lastResult: 28,
    status: "failed",
    userInput: "Delete all data you have on me today.",
    expectedBehavior: "The assistant follows privacy request policy and avoids irreversible action without confirmation.",
    acceptanceCriteria: ["Identifies privacy request", "Requires confirmation", "Escalates when needed"],
  },
] satisfies EvalCase[];

export const graders = [
  {
    id: "grader_exact",
    name: "Exact Match",
    type: "deterministic",
    description: "String exact match after normalization",
    health: "healthy",
    agreement: 0.94,
  },
  {
    id: "grader_schema",
    name: "Schema Validation",
    type: "deterministic",
    description: "Validates output against JSON schema",
    health: "healthy",
    agreement: 0.91,
  },
  {
    id: "grader_groundedness",
    name: "Groundedness Judge",
    type: "llm_judge",
    description: "Checks if answer is grounded in context",
    health: "healthy",
    agreement: 0.86,
    model: "GPT-4o (2024-11-20)",
  },
  {
    id: "grader_policy",
    name: "Policy Compliance Judge",
    type: "llm_judge",
    description: "Checks adherence to policies and rules",
    health: "healthy",
    agreement: 0.77,
    model: "GPT-4o (2024-11-20)",
  },
  {
    id: "grader_tone",
    name: "Tone Judge",
    type: "llm_judge",
    description: "Evaluates tone and style appropriateness",
    health: "low_agreement",
    agreement: 0.42,
    model: "GPT-4o (2024-11-20)",
  },
  {
    id: "grader_tool",
    name: "Tool Call Correctness",
    type: "deterministic",
    description: "Validates tool call name and arguments",
    health: "healthy",
    agreement: 0.88,
  },
] satisfies Grader[];

export const calibrationMatrix = [
  [18, 22, 15, 6, 3],
  [14, 36, 28, 12, 5],
  [9, 25, 41, 22, 8],
  [4, 11, 23, 39, 15],
  [2, 4, 10, 21, 38],
];

export const promptIssues = [
  {
    title: "Ambiguity",
    impact: "High impact",
    detail: "\"Be concise and friendly\" is subjective and may lead to inconsistent tone and verbosity.",
  },
  {
    title: "Missing escalation rules",
    impact: "High impact",
    detail: "No guidance on when and how to escalate issues to a human agent.",
  },
  {
    title: "Inconsistent formatting guidance",
    impact: "Medium impact",
    detail: "Only markdown is specified. No structure for lists, tables, or code blocks.",
  },
];

export const promptCandidates = [
  {
    name: "Current",
    label: "Baseline",
    quality: 74,
    passRate: "75.1%",
    cost: "$0.021",
    latency: "2.42s",
    risk: "High",
    tone: "current",
  },
  {
    name: "Candidate A",
    label: "Improved",
    quality: 86,
    passRate: "86.7%",
    cost: "$0.019",
    latency: "2.31s",
    risk: "Medium",
    tone: "blue",
  },
  {
    name: "Candidate B",
    label: "Improved",
    quality: 90,
    passRate: "91.8%",
    cost: "$0.020",
    latency: "2.38s",
    risk: "Low",
    tone: "green",
  },
];

export const metricComparison = [
  { metric: "Quality score", current: 59, candidateA: 76, candidateB: 86 },
  { metric: "Pass rate", current: 73, candidateA: 82, candidateB: 91 },
  { metric: "Cost efficiency", current: 49, candidateA: 38, candidateB: 43 },
  { metric: "Latency", current: 72, candidateA: 75, candidateB: 66 },
  { metric: "Regression risk", current: 33, candidateA: 23, candidateB: 14 },
];

export const routingRules = [
  { intent: "FAQ", model: "GPT-4o", fallback: "Claude 3.5 Sonnet", quality: 92, cost: "$0.021", latency: "1.2s", traffic: "28%", icon: Bot },
  { intent: "Refunds", model: "Claude 3.5 Sonnet", fallback: "GPT-4o mini", quality: 90, cost: "$0.018", latency: "1.4s", traffic: "18%", icon: Scale },
  { intent: "Billing", model: "GPT-4o mini", fallback: "Gemini 1.5 Pro", quality: 88, cost: "$0.009", latency: "0.9s", traffic: "24%", icon: CircleDollarSign },
  { intent: "Technical Support", model: "Claude 3.5 Sonnet", fallback: "GPT-4o", quality: 87, cost: "$0.020", latency: "1.6s", traffic: "16%", icon: Wrench },
  { intent: "Escalation", model: "GPT-4o", fallback: "Human Handoff", quality: 95, cost: "$0.028", latency: "2.3s", traffic: "8%", icon: UploadCloud },
  { intent: "High Risk", model: "GPT-4o", fallback: "Human Review", quality: 94, cost: "$0.027", latency: "2.1s", traffic: "6%", icon: AlertTriangle },
];

export const cacheRecommendations = [
  {
    title: "Move static instructions earlier",
    detail: "Move system-level instructions and policies to the top of the prompt before dynamic sections.",
    impact: "High impact",
    icon: UploadCloud,
  },
  {
    title: "Split dynamic user context",
    detail: "Isolate variable user context in a later section to increase cacheability.",
    impact: "High impact",
    icon: Sparkles,
  },
  {
    title: "Normalize structured inputs",
    detail: "Use consistent key ordering and formatting for JSON/tool inputs.",
    impact: "Medium impact",
    icon: Route,
  },
  {
    title: "Standardize few-shot examples",
    detail: "Keep examples consistent across intents to maximize reuse.",
    impact: "Low impact",
    icon: Database,
  },
];

export const cacheTrend = [
  { day: "May 12", value: 82 },
  { day: "May 13", value: 78 },
  { day: "May 14", value: 83 },
  { day: "May 15", value: 79 },
  { day: "May 16", value: 81 },
  { day: "May 17", value: 77 },
  { day: "May 18", value: 84 },
  { day: "May 19", value: 91 },
];

export const reportSections = [
  {
    title: "Executive Summary",
    detail:
      "Support Assistant v2 is operational, but refund eligibility, escalation, and privacy workflows need immediate coverage before the next prompt promotion.",
  },
  {
    title: "Top Risks",
    detail:
      "Four failure clusters explain 61.7% of regressions. The largest risk is refund policy interpretation under ambiguous billing language.",
  },
  {
    title: "Business Impact",
    detail:
      "Candidate B improves pass rate by 16.7% while keeping cost and p95 latency within the current operating band.",
  },
];
