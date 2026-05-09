# Product

## Product Description
EvalOps Copilot is intended to be a service-assisted SaaS product for AI teams that need to turn prompts, traces, requirements, and known failures into a living eval system. The first commercial offer is an Eval Debt Audit for one production or pilot AI workflow.

The intended output is not just a dashboard. It is a reviewed audit package: intent map, eval cases, grader definitions, baseline scorecard, failure clusters, prompt recommendations, routing/caching recommendations, and an executive report.

## Target User
- Heads of AI, AI product leads, engineering managers, solution leads, founders, and CTOs responsible for customer-facing AI quality.
- Teams running support assistants, RAG assistants, tool-using workflows, document extraction, or similar AI features.
- Private MVP customers willing to run a service-assisted Eval Debt Audit before broad self-serve usage.

## Core Pain Point
Teams are shipping AI workflows without a maintainable definition of quality. They may have traces, prompts, policies, and examples of bad outputs, but they lack a durable eval suite, calibrated graders, and an operational way to improve prompts and routing over time.

## Value Proposition
EvalOps Copilot helps teams convert real workflow evidence into a credible eval system and a clear executive-ready improvement plan. It should make quality, coverage, risk, cost, and prompt-change decisions visible in one workflow.

## MVP Scope
The MVP should support one Eval Debt Audit for one AI workflow:
- create or select a project;
- define workflow type, objective, risks, and privacy posture;
- upload CSV, JSON, NDJSON, TXT, or conversation/prompt-output trace data;
- validate/redact traces;
- generate and review intents, eval cases, graders, failures, prompt candidates, routing/caching recommendations, and reports;
- export eval/report artifacts;
- support tenant-scoped auth and project data.

## Non-Goals
- Generic observability platform.
- Custom tracing SDK.
- Full LangSmith/Langfuse/Braintrust replacement.
- Enterprise SSO/SAML.
- Self-hosting.
- Browser extension.
- Custom model gateway.
- Production-grade eval execution engine beyond the private MVP audit flow.
- Every third-party trace source integration.

## Key User Journeys
1. **Private MVP entry:** user signs in, sees a project/workspace, and understands the next step.
2. **Create project:** user defines workflow type, objective, risks, privacy mode, and expected outputs.
3. **Trace import:** user uploads a supported file, sees validation/schema preview, redaction status, import progress, and any failures.
4. **Eval review:** user reviews generated eval cases, tags, risk levels, acceptance criteria, provenance, and issue states.
5. **Grader configuration:** user reviews deterministic and LLM-judge graders, thresholds, rubric, calibration evidence, and warnings.
6. **Prompt optimization:** user compares current prompt and candidates with quality, cost, latency, and regression-risk context.
7. **Routing/caching review:** user sees model routing and prompt caching recommendations tied to intent/risk evidence.
8. **Executive report:** user exports a boardroom-ready audit report/eval pack.
9. **Privacy/data controls:** user can understand retention, export data, and request project deletion.

## Acceptance Criteria
- The app builds and runs locally.
- Authenticated users can access protected app surfaces.
- Required MVP screens exist as usable product screens, not only redirects.
- The product surface matches EvalOps Copilot positioning, unless a documented decision intentionally renames/re-scopes it.
- Mock/test mode is explicit and does not masquerade as production.
- Real service mode fails visibly when required vendor credentials are missing.
- Seeded or generated data is obviously fake and non-sensitive.
- Navigation and project selection are coherent.
- Core forms validate predictable inputs.
- Export/report surfaces produce useful artifacts or clearly documented placeholders.
- E2E tests match the intended product contract and pass in CI.

## Current Code Findings
- `prompt.md` and existing docs describe EvalOps Copilot.
- `src/components/workspace-app.tsx` contains a broad EvalOps Copilot UI covering dashboard, projects, trace import, eval builder, graders, prompt optimizer, routing/caching, reports, and settings.
- Active app routes use `src/components/evaller/evaller-app.tsx` for `/workspace`, `/runs`, `/templates`, and `/settings`.
- Required EvalOps pages such as `/dashboard`, `/trace-import`, `/eval-builder`, `/graders`, `/prompt-optimizer`, `/routing-caching`, and `/reports` currently redirect to `/workspace`.
- The public landing page, metadata, active nav, and E2E tests use Evaller/support-AI release-check language rather than full EvalOps Copilot language.
- Backend and database code is more advanced than the active UI suggests.

## Handoff Findings
No migrated `/handoff` route, component, or markdown handoff file was found. Search details are in `docs/HANDOFF_ANALYSIS.md`.

## Product Assumptions To Validate
- Whether the intended product should remain EvalOps Copilot or be re-scoped to Evaller.
- Whether the broad EvalOps `WorkspaceApp` should become the active UI again.
- Whether private MVP buyers need file trace import first or the simpler prompt-scenario Evaller loop first.
- Which outputs are truly required for the first paid audit versus acceptable as founder-assisted deliverables.
- Whether Stripe subscription code should stay in the private MVP or be deferred to invoice/manual billing.
