export const auditPipelineSteps = [
  {
    event: "trace.imported",
    title: "Trace import",
    description: "Validate uploaded CSV, JSON, NDJSON, text, or prompt-output pairs.",
  },
  {
    event: "traces.redacted",
    title: "PII redaction",
    description: "Detect likely PII and persist privacy-safe derived artifacts.",
  },
  {
    event: "intents.generated",
    title: "Intent inference",
    description: "Create a taxonomy of workflow intents, risk labels, and routing tags.",
  },
  {
    event: "eval_cases.generated",
    title: "Eval case generation",
    description: "Generate golden, regression, edge-case, and safety eval cases.",
  },
  {
    event: "graders.generated",
    title: "Grader pack generation",
    description: "Create deterministic checks and LLM judge rubrics with thresholds.",
  },
  {
    event: "baseline.run",
    title: "Baseline run",
    description: "Run the current prompt/model mix against the starter eval suite.",
  },
  {
    event: "prompt.optimized",
    title: "Prompt optimization",
    description: "Compare candidate prompts on quality, cost, latency, and regression risk.",
  },
  {
    event: "routing.analyzed",
    title: "Routing and caching analysis",
    description: "Map intents to models, fallbacks, and cacheable prompt blocks.",
  },
  {
    event: "report.generated",
    title: "Audit report",
    description: "Produce the customer-ready Eval Debt Audit report and eval pack exports.",
  },
] as const;
