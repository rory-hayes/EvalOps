# EvalOps Copilot — PRD

## 1. Detailed product description

EvalOps Copilot is a service-assisted SaaS product for AI teams that need reliable evaluation discipline for customer-facing AI systems. The product helps teams turn prompts, production traces, requirements, policies, and known failures into a living evaluation system that can measure quality, catch regressions, and improve prompts over time.

The initial commercial offer is an Eval Debt Audit. A customer uploads or shares a prompt, traces, requirements, and known failures. The system and founder workflow produce an intent map, eval coverage map, starter eval dataset, grader pack, baseline scorecard, prompt recommendations, routing recommendations, caching recommendations, and an exportable eval pack.

The ongoing product is the maintenance layer. It tracks coverage, regression risk, judge calibration, stale eval risk, prompt changes, model changes, and top failure clusters. It keeps the eval suite alive instead of letting it decay after the first setup.

The first target customer is a B2B SaaS or AI product team with a support assistant, RAG assistant, or customer-facing AI workflow already in pilot or production. The goal is not to replace every existing observability tool. The goal is to become the system that helps teams define, maintain, and improve the evals that determine whether their AI is actually working.

## 2. Technical specifications, stack, and architecture

### Recommended stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Clerk for auth and organizations
- Supabase Postgres + Storage
- Inngest for background workflows
- OpenAI Responses API + Structured Outputs
- Stripe for billing
- Vercel for hosting
- Sentry for error monitoring
- PostHog for product analytics

### Architecture
The app is a multi-tenant web SaaS. Users authenticate into organizations and create one or more AI workflow projects. Each project contains prompts, trace imports, requirements, intents, eval datasets, graders, eval runs, results, prompt candidates, routing rules, and reports.

The frontend is a Next.js dashboard. The backend uses server actions / API routes plus Inngest functions for long-running work like trace import, redaction, eval generation, grader generation, baseline runs, and report generation. Supabase stores structured entities and uploaded trace/report files.

OpenAI is used for intent extraction, eval case generation, grader generation, prompt optimization suggestions, and failure clustering. Deterministic checks are used for exact-match, schema validation, and strict acceptance tests. The product should default to minimal raw-data retention and store derived eval artifacts wherever possible.

## 3. Feature description

### Eval Debt Audit workflow
The first productized workflow starts with project setup, trace import, and requirements intake. The user defines the workflow being evaluated, success criteria, risk profile, data sources, and known failures. The system generates an intent taxonomy, starter datasets, golden cases, regression cases, and edge-case coverage recommendations.

### Eval Builder and Graders
The Eval Builder turns uploaded traces and requirements into structured eval cases. Users can review intent tags, risk levels, expected behaviors, and acceptance criteria. The Graders module supports exact-match checks, schema validation, tool-call validation, groundedness, policy compliance, tone scoring, and LLM-as-judge. Judge calibration is part of the workflow so customers can see where model judges disagree with human expectations.

### Prompt Optimizer, Routing, and Caching
The Prompt Optimizer compares the current prompt against candidate variants and shows quality, pass rate, cost, latency, and regression risk. Routing maps intents to models and fallback policies. Caching analyzes prompt structure to estimate cacheable prefixes, repeated blocks, and potential cost savings from moving static content earlier and dynamic content later.

### Technical implementation notes
Build the core feature set around deterministic workflow steps rather than free-roaming agents. A typical flow is: upload traces -> redact sensitive data -> generate intents -> generate eval cases -> generate graders -> run baseline -> cluster failures -> generate prompt candidates -> compare options -> export report. Use OpenAI Structured Outputs for machine-readable assets, Inngest for durable jobs, and Supabase for storage, isolation, and auditing. Do not build a full observability SDK or enterprise deployment model in the first version.

## 4. Additional information needed

### Product principles
- No blank-state confusion.
- Every recommendation must be explainable.
- The product must show quality, cost, and regression tradeoffs together.
- The system should support export into existing eval stacks rather than forcing lock-in.
- Privacy controls must be visible and understandable.

### Non-goals for v1
- Full LangSmith replacement
- Full Langfuse replacement
- Full observability platform
- Self-hosting
- SSO/SAML
- Enterprise procurement features
- Real-time SDK ingestion for every framework
- Agent runtime/orchestration platform

### MVP deliverables
- Project creation wizard
- Trace import and redaction controls
- Eval Builder
- Graders + calibration view
- Prompt Optimizer
- Routing & Caching view
- Eval Health dashboard
- Exportable audit report

### Success metrics
- Time to first audit completed
- % of uploaded traces turned into usable eval cases
- Eval coverage improvement after first audit
- Prompt quality delta after optimizer workflow
- Customer conversion from audit to monthly subscription
