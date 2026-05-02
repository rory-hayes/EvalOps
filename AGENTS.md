# AGENTS.md — EvalOps Copilot Engineering Guide

## Purpose
This file tells coding agents how to work in this repository.
Treat this file as the operational guide.
Treat `prompt.md` as the product source of truth.
If the two conflict, prefer:
1. explicit user instruction;
2. `prompt.md` for product intent;
3. `AGENTS.md` for implementation rules.

---

## Working style
- Build in **small, reviewable milestones**.
- Favor **clarity and polish** over feature sprawl.
- Prefer off-the-shelf services unless the functionality is core differentiation.
- Do not implement speculative enterprise features.
- Do not replace vendor services with custom infrastructure without a strong reason.
- Keep the codebase solo-founder maintainable.

---

## Repository goals
This repository should become the codebase for **EvalOps Copilot**.
The first build target is a **private MVP** that supports the Eval Debt Audit workflow.

The product is a polished SaaS web app with:
- multi-tenant projects;
- trace upload and review;
- eval generation and maintenance workflows;
- grader configuration and calibration;
- prompt optimization;
- routing and caching recommendations;
- executive reporting.

---

## Preferred stack
Use the following defaults unless the repository already has a compatible alternative:

### Frontend
- Next.js
- TypeScript
- App Router
- Tailwind CSS
- shadcn/ui
- Recharts or equivalent for charts

### Backend / persistence
- Next.js server actions / route handlers
- Supabase Postgres
- Supabase Storage

### Auth / orgs
- Supabase Auth with organisation membership records

### Async workflows
- Inngest

### AI / generation
- OpenAI Responses API
- Structured Outputs

### Infra / ops
- Vercel
- Stripe (later)
- Sentry
- PostHog

Do not introduce extra services unless clearly justified.

---

## Implementation principles
1. **Product before platform**
   Build user-visible workflows before infrastructure abstractions.
2. **Mock before overbuilding**
   For Milestone 1, it is acceptable to use realistic mocked data or mocked generation layers.
3. **Deterministic shell**
   Build deterministic page flows and typed data models even if AI workflows are mocked first.
4. **Strong typing**
   Use TypeScript types and Zod schemas for core entities.
5. **Accessible UI**
   Build keyboard-accessible forms, buttons, and navigation where practical.
6. **Calm design**
   Avoid noisy layouts and unnecessary animations.
7. **No magic hidden state**
   Keep state transitions explicit and debuggable.

---

## Scope control
For Milestone 1, do NOT build:
- full integrations with LangSmith, Langfuse, Braintrust, Zendesk, Intercom, etc.;
- enterprise SSO/SAML;
- self-hosting;
- billing and subscriptions beyond placeholders;
- production-grade eval execution engine;
- a custom SDK for tracing;
- a custom model gateway;
- generic all-in-one observability platform features;
- browser extensions.

Allowed for Milestone 1:
- placeholders and disabled “coming soon” integration affordances;
- mocked import data;
- mocked eval generation results;
- mocked optimizer results;
- static sample charts/tables.

---

## Must-have pages for Milestone 1
Implement the following pages/components:

1. `Dashboard`
2. `Projects / Create New Project`
3. `Trace Import`
4. `Eval Builder`
5. `Graders`
6. `Prompt Optimizer`
7. `Routing & Caching`
8. `Reports`
9. `Settings` (lightweight)

A shared left navigation and top project switcher should exist.

---

## UX expectations
The app should feel:
- polished enough for a paid B2B product;
- visually consistent;
- easy to scan;
- confident and minimal.

Do:
- use strong section headers;
- keep card layouts clean;
- prefer 2–3 levels of hierarchy, not more;
- show meaningful placeholder data;
- include supportive empty and loading states.

Do not:
- clutter the screen;
- overuse bright colors;
- add needless motion;
- build toy dashboards.

---

## Design system guidance
- Use a light theme by default.
- Use one accent color family consistently.
- Use red/orange/yellow sparingly for failure/risk states.
- Use green only for genuinely healthy states.
- Use rounded cards and clean spacing.
- Prioritize whitespace and legibility.

Typography should be professional, not playful.

---

## Data model guidance
Model these entities early, even if seeded or mocked:
- Organization
- User
- Project
- WorkflowType
- TraceImport
- Trace
- Intent
- EvalDataset
- EvalCase
- Grader
- EvalRun
- EvalResult
- FailureCluster
- PromptVersion
- PromptCandidate
- RoutingRule
- CacheRecommendation
- Report

Use Zod schemas and typed interfaces for these.

---

## Code structure guidance
Prefer a structure like:

- `app/` for routes and pages
- `components/` for reusable UI
- `lib/` for domain logic, schemas, helpers, providers
- `data/` for mock seed data if needed
- `types/` or `lib/schemas/` for typed domain models

If adding mock data, keep it organized and reusable.

---

## Domain logic guidance
Core product logic should eventually live in dedicated modules:
- trace ingestion / validation
- privacy / redaction
- intent taxonomy generation
- eval case generation
- grader configuration
- judge calibration
- prompt analysis / optimization
- routing recommendation
- caching recommendation
- reporting

For Milestone 1, these can be mocked or partially implemented, but their module boundaries should be clear.

---

## Privacy rules
This product touches sensitive customer data.
Design for privacy from the start.

Rules:
- never hardcode secrets;
- never log raw sensitive content casually;
- expose redaction controls in the UI;
- show retention-aware UX where relevant;
- prefer storing derived artifacts over raw traces;
- make delete/export flows easier to add later.

If building mock data, ensure it is fake and obviously non-sensitive.

---

## API / AI guidance
When adding real OpenAI integration in later milestones:
- use Responses API;
- prefer Structured Outputs;
- keep schemas explicit;
- isolate LLM calls in a dedicated service layer;
- design outputs so they can be rendered in the existing UI with minimal change.

Do not scatter LLM call logic across the UI.

---

## Testing expectations
At minimum, add:
- linting;
- typechecking;
- basic unit tests for pure helpers/schemas if introduced.

If test infra exists, use it.
If not, do not spend Milestone 1 building a huge test harness.

Do ensure:
- pages build;
- navigation works;
- mock data renders reliably;
- forms behave predictably.

---

## Done definition for Milestone 1
Milestone 1 is done when:
- the app builds and runs locally;
- core navigation exists;
- all required screens exist;
- the UI reflects the product described in `prompt.md`;
- seeded/mock data makes the app believable;
- the product feels polished rather than placeholder-heavy;
- there is a clear path to wiring in real generation workflows next.

---

## What to do before coding
1. Read `prompt.md`.
2. Inspect repository structure.
3. Determine what already exists.
4. Create a short implementation plan.
5. Then build Milestone 1 only.

Do not attempt the whole company, all integrations, or enterprise functionality in one pass.

---

## What to report after work
When completing a task, report:
- what was built;
- which files changed;
- what commands were run;
- what remains for the next milestone;
- any assumptions made.

Keep the report concise and useful.
