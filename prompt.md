# EvalOps Copilot — Product Prompt

## Mission
Build **EvalOps Copilot**, a polished, service-assisted SaaS product that helps AI teams **create, maintain, and improve high-quality evals** for production AI assistants, RAG systems, and tool-using workflows.

The product is **not** a generic observability dashboard and **not** a generic eval runner. The product’s wedge is:

- turning prompts, traces, requirements, and failures into a living eval system;
- helping teams define what “good” looks like;
- generating starter eval suites and graders;
- maintaining eval quality over time;
- optimizing prompts, model routing, and prompt caching using eval results.

The first commercial offer is an **Eval Debt Audit**. The software must support this audit workflow first, and only then expand into a broader self-serve EvalOps product.

---

## Core positioning
**Tagline:** Create, maintain, and improve high-quality AI evals.

**Tight offering:** EvalOps Copilot helps AI teams take a real workflow that is already in pilot or production and transform it into a measurable, maintainable eval system with actionable recommendations.

**Primary ICP:**
- B2B SaaS and AI product teams;
- customer-facing AI assistants;
- support assistants;
- RAG / knowledge assistants;
- tool-using AI workflows;
- teams already shipping AI but lacking mature eval discipline.

**Primary buyer / champion:**
- Head of AI
- AI / ML product lead
- Engineering manager owning AI reliability
- Solutions / implementation lead
- Founder / CTO at AI-first companies

---

## Product principles
1. **Polished enough to justify paid usage.**
   The product must feel premium, clear, and trustworthy.
2. **Service-assisted first.**
   Build software that supports the Eval Debt Audit and ongoing maintenance, not a giant all-in-one platform on day one.
3. **Customer data should remain customer-owned.**
   Default to minimal raw retention, redaction, and derived artifacts.
4. **Deterministic where possible, LLM-judged where necessary.**
   Use rules for exact checks and LLMs for judgment-heavy checks.
5. **Maintenance is the moat.**
   The product should help users keep evals up to date, not just create them once.
6. **Do not overbuild infrastructure.**
   Use best-in-class off-the-shelf services for auth, storage, background jobs, deployment, and billing.

---

## What the customer brings
The customer should bring their own:
- prompt or system instructions;
- trace examples / conversations / prompt-output pairs;
- requirements and policies;
- known bad outputs / production failures;
- current model choices and constraints.

We may provide starter templates and workflow presets, but the product’s core value is helping users turn **their own data** into usable eval systems.

---

## What the product outputs
For each project, the product should be able to generate and maintain:
- project definition;
- workflow / risk profile;
- intent taxonomy;
- eval coverage map;
- golden dataset;
- regression dataset;
- edge-case and safety dataset;
- grader pack;
- baseline scorecard;
- failure clusters;
- prompt optimization recommendations;
- model routing recommendations;
- prompt caching recommendations;
- executive report / exportable eval pack.

---

## MVP scope
Build the **private MVP** first.

### MVP goal
Support a paid **Eval Debt Audit** for one AI workflow.

### MVP inputs
- one project / workflow;
- one prompt;
- up to ~100 uploaded traces or prompt-output pairs;
- requirements / policy docs;
- known failures.

### MVP outputs
- intent map;
- starter eval dataset;
- grader definitions;
- baseline quality score;
- failure clusters;
- prompt optimization suggestions;
- routing suggestions;
- caching suggestions;
- executive report.

### MVP screens
1. **Dashboard / Eval Health Overview**
2. **Create New Project**
3. **Trace Import**
4. **Eval Builder**
5. **Graders / Judge Calibration**
6. **Prompt Optimizer**
7. **Routing & Caching**
8. **Reports**

---

## Dashboard requirements
The main dashboard should communicate:
- overall eval health;
- intent coverage;
- regression safety;
- judge calibration;
- cost efficiency;
- stale eval risk;
- eval pass rate over time;
- coverage by intent;
- top failure clusters;
- recent eval runs;
- recommended actions.

This page should feel clear, executive-friendly, and operational.

---

## Project setup requirements
The Create Project flow should guide the user through:
1. selecting the workflow type (support assistant, RAG, tool-using agent, document extraction, custom);
2. describing the project objective;
3. defining risks and primary goals;
4. choosing privacy preferences;
5. previewing what the product will generate.

The wizard should feel deliberate and low-friction.

---

## Trace import requirements
The product must support:
- CSV upload;
- JSON / NDJSON upload;
- plain text / conversation logs;
- prompt-output pairs.

The system should:
- validate files;
- preview schema mapping;
- detect / redact likely PII;
- display import progress;
- classify imported traces by intent and risk later in the workflow.

Do not build all third-party integrations first. File upload is enough for MVP.

---

## Eval Builder requirements
The Eval Builder should support:
- golden set;
- regression set;
- edge cases;
- safety / adversarial cases;
- bulk tagging;
- filters;
- risk levels;
- source provenance (production, synthetic, requirements, known failure);
- inline case editing;
- export of eval pack.

The product should make it obvious which areas are well covered and which are weak.

---

## Graders requirements
The Graders module should support:
- deterministic graders (exact match, schema validation, rule-based checks);
- LLM-as-judge graders (tone, policy compliance, groundedness, helpfulness, tool correctness);
- threshold configuration;
- scoring rubric visibility;
- calibration against human labels / reference scores;
- grader health and disagreement warnings.

Judge calibration is a core differentiator and should be treated as first-class product value.

---

## Prompt Optimizer requirements
The Prompt Optimizer should:
- show the current prompt;
- identify likely issues (ambiguity, missing escalation rules, redundant instructions, poor formatting guidance);
- generate candidate prompts;
- compare candidates on quality, cost, latency, and regression risk;
- provide a recommendation with explanation;
- never blindly auto-promote changes without clear user approval.

Prompt optimization should be explicitly tied to eval results.

---

## Routing & Caching requirements
This module should:
- map intents to models and fallback paths;
- show quality score, cost, latency, and traffic share per route;
- identify high-risk intents requiring stronger routing or human review;
- analyze prompt structure for caching opportunities;
- estimate savings from prompt caching and improved routing.

The UX should feel operational, not academic.

---

## Reports requirements
Reports must feel boardroom-ready and customer-ready.

Include:
- eval health score;
- executive summary;
- top risks;
- coverage map;
- baseline scorecard;
- business impact opportunities;
- prioritized recommendations;
- export to PDF / eval pack.

The output should be polished enough that a buyer feels they paid for something concrete.

---

## Privacy requirements
Build privacy controls from day one:
- allow PII redaction toggle;
- allow short raw-data retention;
- allow “store derived evals only” mode;
- show data residency field / placeholder;
- allow export/delete of project data;
- design workflows so raw customer traces are not retained longer than necessary by default.

Use provider settings that minimize retention where practical.

---

## Non-goals for MVP
Do **not** build the following in the first milestone:
- full LangSmith replacement;
- full observability / tracing SDK;
- every third-party integration;
- browser extension;
- enterprise SSO / SAML;
- self-hosted deployment;
- custom model gateway;
- custom vector DB infrastructure;
- full billing automation before pilots;
- generic all-in-one AI platform.

---

## Recommended tech stack
Use:
- Next.js
- TypeScript
- Tailwind
- shadcn/ui
- Clerk
- Supabase (Postgres + Storage)
- Inngest
- OpenAI Responses API + Structured Outputs
- Vercel
- Stripe (later / pilot billing first)
- Sentry
- PostHog

---

## Quality bar
The product must feel:
- premium;
- opinionated;
- trustworthy;
- calm and uncluttered;
- suitable for a paying B2B user.

The UI should prioritize:
- readability;
- strong hierarchy;
- meaningful defaults;
- visible explanations;
- crisp tables and scorecards;
- minimal but thoughtful use of color.

---

## Success criteria for Milestone 1
Milestone 1 is successful if the product can:
- let a user create a project;
- import sample traces;
- display privacy controls and import status;
- show a believable dashboard;
- show generated eval cases in the Eval Builder;
- show grader definitions and calibration UI;
- show prompt comparison UI;
- show routing/caching recommendations;
- produce a polished report view.

It is acceptable to use mocked AI data and mocked generation in Milestone 1 **if** the UI, data model, and workflow are built cleanly and in a way that can be connected to real services next.

---

## Build order
1. App scaffold and auth
2. Core layout and navigation
3. Project creation flow
4. Trace import flow
5. Eval Builder UI
6. Graders UI
7. Prompt Optimizer UI
8. Routing & Caching UI
9. Reports UI
10. Wire up mocked data
11. Add real generation workflows in later milestones

