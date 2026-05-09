# ROADMAP.md

Last audited: 2026-05-09

## 1. Product Summary

This repository appears to be a Next.js SaaS product for AI evaluation workflows. The product source material in `prompt.md`, `docs/PRODUCT.md`, and `docs/evalops_copilot_prd.md` describes **EvalOps Copilot**: a private MVP for running an Eval Debt Audit on one customer-facing AI workflow. The intended customer is an AI/product/engineering owner who can upload traces or prompt-output examples, generate eval cases and graders, review failures, compare prompt candidates, inspect routing/caching recommendations, and export an executive audit report.

The currently active app surface is narrower. The public landing page, metadata, navigation, and active authenticated routes are branded as **Evaller**, a support-AI release-readiness loop. That active flow lets a user configure a support AI test, define scenarios and success criteria, run an AI test, apply a prompt fix, rerun, review run history, copy/approve readiness reports, and manage a focused settings/templates area.

The canonical product decision is recorded in `docs/PRODUCT_SURFACE_DECISION.md`: this repo ships **EvalOps Copilot** as the private MVP product, with **Evaller as a support-AI release-check sub-flow inside EvalOps Copilot**. Follow-up work must align routes, navigation, metadata, copy, tests, and data ownership to that decision.

## 2. Current Implementation Status

### Authentication

Status: **Partially Implemented**

- Supabase Auth is the production identity provider through `@supabase/ssr`.
- `src/lib/supabase/proxy.ts` protects non-public app routes when Supabase public config is present.
- `src/lib/server/auth.ts` resolves server actors from Supabase users in production and deterministic headers in `EVALOPS_TEST_MODE=1`.
- Login, signup, auth confirmation, logout, invite acceptance, and redirect tests exist.
- Live Supabase auth was not verified in this audit because production smoke credentials are not configured.

### Core user flows

Status: **Partially Implemented**

- Active Evaller flow exists at `/workspace`, `/runs`, `/templates`, and `/settings`.
- Active Evaller APIs cover workspace save/load, runs, fix application, prompt restore, readiness report copy/approval, review comments, and invitations.
- Broader EvalOps APIs and store logic cover projects, trace import, processing jobs, eval cases, graders, reports, exports, project deletion, support, billing, team membership, and privacy operations.
- Required EvalOps MVP pages `/dashboard`, `/projects`, `/trace-import`, `/eval-builder`, `/graders`, `/prompt-optimizer`, `/routing-caching`, `/reports`, and `/onboarding` currently redirect to `/workspace`.

### UI / UX

Status: **Partially Implemented**

- The active Evaller UI has polished B2B styling, loading/error/success states, mobile navigation coverage, and real screenshots on the landing page.
- `src/components/workspace-app.tsx` contains a broad EvalOps interface with dashboard, projects, trace import, eval builder, graders, optimizer, routing/caching, reports, and settings views, but it is not wired into the current route set.
- Product naming is inconsistent across docs, metadata, landing page, legal pages, active app shell, tests, and route intent.
- The two largest UI files are large and risky to change casually: `src/components/workspace-app.tsx` and `src/components/evaller/evaller-app.tsx`.

### Data model

Status: **Partially Implemented**

- Supabase migrations define substantial EvalOps tables: organizations, memberships, billing, invitations, projects, trace imports, uploaded files, traces, processing jobs, eval cases, graders, eval runs/results, human labels, calibration, failures, prompts, routing rules, cache recommendations, reports, exports, data operation receipts, support requests, usage, audit events, and private Storage policies.
- Later migrations define Evaller `ai_test_*` tables for AI tests, prompt versions, scenarios, criteria, runs, results, failure patterns, prompt suggestions, readiness reports, comments, members, and invitations.
- Local deterministic stores exist for both EvalOps and Evaller under `src/lib/server/local-store.ts` and `src/lib/evaller/local-store.ts`.
- The boundary between EvalOps project data and Evaller AI-test data is not documented as a final architecture decision.

### API / backend

Status: **Partially Implemented**

- Next.js App Router API routes exist under `src/app/api`.
- API responses use a shared envelope with `ok`, `data` or `error`, and `correlationId` in `src/lib/server/api.ts`.
- Request validation uses Zod schemas in `src/lib/server/schemas.ts` and `src/lib/evaller/schemas.ts`.
- Inngest functions exist for trace import, full project export, and project deletion.
- Production paths require Supabase, OpenAI, Inngest, and billing env vars; deterministic test mode runs locally.
- Backend coverage is stronger than active UI coverage, but production-mode services were not smoke-tested against a live deployment in this audit.

### Integrations

Status: **Partially Implemented**

- Supabase Auth/Postgres/Storage integration code exists.
- OpenAI Responses API boundaries exist under `src/lib/ai` and `src/lib/evaller/ai.ts`.
- Inngest integration exists under `src/lib/inngest`.
- Stripe checkout, portal, webhook, plan, usage, and billing status code exists.
- Vercel Analytics is included in `src/app/layout.tsx`.
- Sentry and PostHog are present only as env placeholders and legal/subprocessor copy. No runtime Sentry/PostHog integration was found.

### Testing

Status: **Partially Implemented**

Fresh validation on 2026-05-09:

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed when run standalone, 22 files and 97 tests.
- `npm run build`: passed, 43 app routes generated.
- `npm run test:e2e`: failed, 3 failed and 7 passed.
- `npm run smoke:production`: failed fast because required smoke env vars are missing.

Current E2E failures:

- `tests/e2e/core-flow.spec.ts` expects a `Workspace` heading; active UI renders `Workspace Cockpit`.
- `tests/e2e/landing-onboarding.spec.ts` expects `/` to redirect to `/workspace`; active `/` renders the public landing page.
- `tests/e2e/project-switching.spec.ts` expects `More Templates Later`; active Templates copy does not contain that text.

### Deployment

Status: **Partially Implemented**

- GitHub Actions CI exists in `.github/workflows/ci.yml` and runs install, lint, typecheck, tests, build, and Playwright.
- A manual production smoke workflow exists in `.github/workflows/production-smoke.yml`.
- `scripts/production-smoke.mjs` performs a live readiness, Supabase Auth, billing readiness, Evaller run loop, EvalOps project/import/export/delete, RLS, and Storage isolation smoke.
- Vercel is assumed, but there is no `vercel.json`; deployment behavior relies on framework defaults and environment configuration.
- Production smoke cannot run locally without live smoke/vendor credentials.

### Observability / logging

Status: **Partially Implemented**

- Server API errors emit structured log events through `src/lib/server/logger.ts`.
- API responses include correlation IDs.
- `/api/health` and token-protected `/api/readiness` exist.
- Vercel Analytics is installed.
- No confirmed Sentry/PostHog runtime instrumentation, alerting, dashboards, or incident runbook was found.

### Security

Status: **Partially Implemented**

- Supabase RLS policies and private Storage bucket policies are defined in migrations.
- Service-role keys are server-only and `.env.example` keeps secrets blank.
- Test mode is explicitly blocked in hosted production by env checks.
- Readiness is protected by `EVALOPS_SMOKE_TOKEN`.
- Stripe webhook signature verification exists.
- Legal, privacy, DPA, subprocessors, and contact pages exist but are placeholder-level and need counsel/operator review.
- Latest remote Supabase migrations, RLS, Storage policies, Auth dashboard settings, and production tenant isolation were not verified in this audit.

## 3. Repository Architecture

### Frontend framework

- Next.js 16 App Router.
- React 19 and TypeScript.
- Tailwind CSS v4 through PostCSS.
- Geist fonts via `next/font`.
- Lucide icons.
- Custom primitives in `src/components/primitives.tsx`. No shadcn/ui package is installed.

### Backend/API structure

- API routes live in `src/app/api`.
- Shared API helpers live in `src/lib/server/api.ts`.
- Auth and actor resolution live in `src/lib/server/auth.ts`.
- EvalOps store contract and types live in `src/lib/server/types.ts`.
- Evaller store contract and types live in `src/lib/evaller/types.ts`.
- Production stores are Supabase-backed. Test stores are local file-backed.
- Inngest jobs live in `src/lib/inngest/functions.ts` and workflow modules under `src/lib/workflows`.

### State management

- The active Evaller UI uses React component state and fetches API endpoints directly.
- Broader EvalOps UI uses React state in `src/components/workspace-app.tsx`, browser local storage for selected project, and API-backed workspace state.
- There is no global client-state library.

### Auth approach

- Supabase Auth in production.
- Test-mode actors via deterministic headers and defaults.
- Public route allowlist in `src/lib/supabase/proxy.ts`.
- Organization selection stored in an `evalops_org_id` cookie.

### Database/storage approach

- Supabase Postgres and Storage in production.
- Migrations are in `supabase/migrations`.
- Local deterministic stores are used when `EVALOPS_TEST_MODE=1`.
- Storage buckets are expected for trace uploads and exports.

### Test setup

- Vitest for unit and API integration tests, configured in `vitest.config.mts`.
- Playwright for browser E2E, configured in `playwright.config.ts`.
- Playwright starts Next.js on port 3100 with `EVALOPS_TEST_MODE=1` and `.evalops/e2e`.

### Deployment setup

- Next.js build scripts in `package.json`.
- GitHub Actions CI exists.
- Manual production smoke workflow exists.
- Vercel is the assumed hosting target.
- Supabase, OpenAI, Inngest, Stripe, and smoke credentials must be configured outside the repo.

### Important architectural patterns

- Explicit deterministic test mode rather than hidden fake production behavior.
- Store interfaces isolate UI/API from persistence implementation.
- Server-only AI and vendor integrations.
- Zod request validation.
- Correlation IDs on API responses.
- Tenant-scoped data model through organizations and memberships.

### Unclear architecture

- Whether EvalOps and Evaller are separate products, nested domains, or one replacing the other.
- Whether the broad `WorkspaceApp` should be revived, refactored into route components, or retired.
- Whether Stripe billing should gate private MVP usage or remain manual/invoice-based.
- Whether Sentry/PostHog should be enabled before private MVP launch.

## 4. Production Readiness Assessment

Rating: **MVP In Progress**

The repo is beyond a prototype technically: it builds, has substantial domain code, store contracts, Supabase migrations, local deterministic mode, OpenAI/Inngest/Stripe integration boundaries, CI, unit/API tests, and a live smoke script.

It is not MVP Ready because the active product surface does not match the stated EvalOps MVP, the browser E2E suite is red, production smoke cannot run without env setup, and the core product decision is unresolved.

### Reliability gaps

- E2E suite fails against current UI contract.
- Live production smoke is blocked by missing env vars.
- Production async paths were not verified in this audit.
- Required MVP routes are redirects, making route-level reliability misleading.

### Security gaps

- Remote RLS and Storage isolation were not freshly verified.
- Auth dashboard hardening and email/SAML/MFA posture are not proven from local repo alone.
- Product data boundary between EvalOps and Evaller remains unresolved.

### Data validation gaps

- API validation is strong in many areas, but active UI does not expose the full EvalOps workflow.
- Trace import validation exists, but live file upload and processing were not verified against real Supabase/Inngest/OpenAI in this audit.

### Error/loading/empty state gaps

- Active Evaller UI includes meaningful states.
- Inactive EvalOps views contain states but are not route-active.
- Required MVP route state quality cannot be trusted until routes are wired.

### Test coverage gaps

- Unit/API coverage is good.
- E2E coverage is currently failing and partly stale.
- No confirmed CI-green baseline until E2E is repaired.
- Production smoke requires external setup.

### Deployment confidence gaps

- CI workflow exists but would fail while E2E is red.
- Smoke workflow exists but requires secrets and live services.
- Vercel environment readiness is not verified.

### Monitoring/logging gaps

- Structured logs and correlation IDs exist.
- No confirmed Sentry/PostHog runtime instrumentation.
- No documented alerting or incident response workflow beyond placeholder contact/legal pages.

### User onboarding gaps

- Active Evaller onboarding is simple and visible through signup and templates.
- EvalOps project creation/onboarding route currently redirects.
- Product promise and active onboarding are mismatched.

### Billing/subscription gaps

- Stripe code paths exist.
- Commercial copy and billing launch posture need a decision.
- Smoke script expects active/trialing billing for paid actions, but no live verification was run.

### Admin/support workflow gaps

- Support request API and contact page exist.
- Operator processes, monitored addresses, incident handling, and support SLAs are not production-confirmed.

## 5. Critical Gaps

### GAP-001: Product surface implementation is misaligned

Priority: P0
Area: UX / Product
Status: Decision Recorded / Implementation Open

#### Gap

The repo contains two product surfaces: canonical EvalOps Copilot and active Evaller. `docs/PRODUCT_SURFACE_DECISION.md` records EvalOps Copilot as canonical and Evaller as a support-AI release-check sub-flow, but the active app still exposes Evaller as the top-level product.

#### Impact

Codex runs can implement the wrong product, tests can encode the wrong contract, and customer-facing copy can promise workflows that are not active.

#### Evidence

- `prompt.md` describes EvalOps Copilot and the Eval Debt Audit workflow.
- `src/app/layout.tsx` metadata title is `Evaller`.
- `src/components/app-shell.tsx` brand is `Evaller`.
- `src/components/landing-page.tsx` markets support AI release checks.
- `src/components/workspace-app.tsx` contains broad EvalOps views but required pages redirect.

#### Recommended Fix

Use `docs/PRODUCT_SURFACE_DECISION.md` as the source of truth. Then update route, nav, copy, data model, and test plans to match.

### GAP-002: Required EvalOps MVP routes redirect to `/workspace`

Priority: P0
Area: UX
Status: Open

#### Gap

The pages required by `prompt.md` are present as files but redirect to the active Evaller workspace instead of rendering distinct EvalOps workflows.

#### Impact

The app cannot deliver the intended Eval Debt Audit journey through the browser.

#### Evidence

- `src/app/dashboard/page.tsx`, `src/app/projects/page.tsx`, `src/app/trace-import/page.tsx`, `src/app/eval-builder/page.tsx`, `src/app/graders/page.tsx`, `src/app/prompt-optimizer/page.tsx`, `src/app/routing-caching/page.tsx`, `src/app/reports/page.tsx`, and `src/app/onboarding/page.tsx` all call `redirect("/workspace")`.
- Active navigation in `src/lib/navigation.ts` exposes only Workspace, Runs, Templates, and Settings.

#### Recommended Fix

After the product decision, wire each canonical route to a focused view. If EvalOps remains the target, revive or split `WorkspaceApp` into route-specific screens.

### GAP-003: Browser E2E suite is red

Priority: P0
Area: Testing
Status: Open

#### Gap

Playwright tests fail against the current app.

#### Impact

CI cannot be trusted as a merge gate, and route/copy regressions will be noisy.

#### Evidence

Fresh `npm run test:e2e` on 2026-05-09 produced 3 failed and 7 passed tests. Failures are stale assertions for root redirect behavior, workspace heading copy, and Templates copy.

#### Recommended Fix

Do not weaken assertions blindly. First lock the route/product contract, then update tests or app behavior to match that contract.

### GAP-004: Production smoke is blocked by missing live configuration

Priority: P0
Area: Deployment
Status: Open

#### Gap

The production smoke script cannot run without external env vars.

#### Impact

Supabase Auth, RLS, Storage, OpenAI, Inngest, Stripe, live exports, and deletion cannot be considered production-verified.

#### Evidence

Fresh `npm run smoke:production` failed with missing `EVALOPS_BASE_URL`, smoke users, Supabase public vars, and `OPENAI_EVALLER_MODEL`.

#### Recommended Fix

Configure preview smoke credentials outside the repo, run smoke against preview, record any service failures, then wire the workflow into release discipline.

### GAP-005: EvalOps and Evaller data models overlap without a final boundary

Priority: P0
Area: Data
Status: Open

#### Gap

The repo has both EvalOps entities and Evaller `ai_test_*` entities.

#### Impact

Data exports, tenant isolation, billing, reporting, and future migrations can become inconsistent.

#### Evidence

- EvalOps types live in `src/lib/server/types.ts`.
- Evaller types live in `src/lib/evaller/types.ts`.
- Both models have Supabase migrations.
- `linear-export/issues.json` already identifies `EVL-DATA-001` for this boundary.

#### Recommended Fix

Document whether Evaller is a subdomain, a temporary product surface, or the canonical model. Add migration implications without dropping data.

### GAP-006: Live tenant isolation is not freshly verified

Priority: P0
Area: Security
Status: Open

#### Gap

RLS and private Storage policies exist, but this audit did not verify the latest remote Supabase state.

#### Impact

Cross-tenant access bugs are launch-blocking for customer AI trace data.

#### Evidence

- Migrations enable RLS and define tenant policies.
- `scripts/production-smoke.mjs` includes RLS and Storage isolation checks.
- Smoke did not run because required env vars were missing.

#### Recommended Fix

Run preview smoke and direct Supabase isolation checks with two users and two organizations after migrations are applied.

### GAP-007: Commercial and legal posture is placeholder-level

Priority: P1
Area: Security / Billing / Other
Status: Open

#### Gap

Legal, DPA, privacy, subprocessors, billing, and support surfaces exist but are not final.

#### Impact

The app may look commercially ready before counsel/operator review is complete.

#### Evidence

- `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, `src/app/dpa/page.tsx`, and related docs describe placeholder language.
- `docs/milestone-6-commercial-readiness.md` explicitly requires counsel review.

#### Recommended Fix

Decide private MVP billing posture, review legal/support copy, and ensure UI does not imply unavailable self-serve billing.

### GAP-008: Observability is minimal

Priority: P1
Area: Observability
Status: Open

#### Gap

The app has logs, correlation IDs, health, readiness, and Vercel Analytics, but no confirmed error tracking, product analytics taxonomy, alerts, or runbooks.

#### Impact

Failures in live AI, worker, auth, billing, or export flows may be hard to diagnose for early users.

#### Evidence

- `src/lib/server/api.ts` logs 500s and returns correlation IDs.
- `.env.example` includes Sentry/PostHog placeholders.
- No runtime Sentry/PostHog setup was found.

#### Recommended Fix

Define privacy-safe event/error capture policy, then add minimal monitoring and alerting only after the policy is approved.

## 6. Ordered Delivery Plan

### Phase 0: Stabilisation

Goal: Stop product and test drift before expanding features.

Tasks:

- Record the canonical product decision.
- Record canonical route, navigation, and project switcher contract.
- Document EvalOps vs Evaller data ownership boundary.
- Re-audit env/readiness configuration against code.
- Repair current E2E assertions once the route contract is agreed.
- Verify that CI is green after E2E repair.

Acceptance criteria:

- A new engineer can tell which product surface is authoritative.
- The active route list and tests match the decision.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` pass locally.

Suggested validation commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

### Phase 1: MVP Completion

Goal: Deliver the core Eval Debt Audit or explicitly scoped Evaller MVP through active routes.

Tasks:

- Wire canonical MVP pages one at a time.
- Restore or implement project creation/selection.
- Wire trace import route if EvalOps remains the target.
- Wire eval builder, graders, prompt optimizer, routing/caching, reports, and settings.
- Add route-level empty/loading/error coverage.
- Ensure exports and reports are accessible from the active UI.

Acceptance criteria:

- A signed-in user can complete the chosen MVP flow end to end in deterministic test mode.
- Required MVP pages are either active or explicitly removed from the product contract.
- Browser tests cover the primary happy path and key empty/error states.

Suggested validation commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

### Phase 2: Production Hardening

Goal: Prove real service operation before inviting real users.

Tasks:

- Apply and verify Supabase migrations on preview.
- Run Supabase advisors and record results.
- Configure preview env vars outside the repo.
- Run production smoke against preview.
- Verify Supabase Auth, RLS, Storage isolation, Inngest processing, OpenAI generation, Stripe gates, exports, and deletion.
- Add minimal observability and support runbooks.

Acceptance criteria:

- Preview smoke passes.
- Tenant isolation is verified with two users.
- Production env docs match code.
- Legal/support/billing posture is approved for private MVP use.

Suggested validation commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
EVALOPS_BASE_URL=<preview-url> npm run smoke:production
```

### Phase 3: Growth / Scale

Goal: Improve maintainability, operations, and expansion after the MVP is credible.

Tasks:

- Split oversized UI components by route/domain.
- Add monitored raw-retention purge.
- Add Sentry/PostHog or equivalent with privacy-safe event taxonomy.
- Expand accessibility coverage.
- Decide third-party import integrations.
- Add billing self-serve only if commercial posture supports it.

Acceptance criteria:

- Feature work is route/domain-scoped and low-risk.
- Monitoring catches production failures.
- Privacy/data operations are scheduled and auditable.
- New integrations are added behind explicit product decisions.

Suggested validation commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## 7. Backlog

### TASK-001: Record canonical product surface decision

Status: Done
Priority: P0
Area: Other
Depends on: None
Linear: EVL-PROD-001

#### Goal

Decide whether this repo ships EvalOps Copilot, Evaller, or Evaller as a sub-flow inside EvalOps.

#### Scope

Create a decision record or update product docs with canonical product name, route set, navigation labels, landing stance, and data model implications. Do not change app behavior.

Decision record: `docs/PRODUCT_SURFACE_DECISION.md`.

#### Acceptance Criteria

- [ ] Canonical product surface is stated in one clear place.
- [ ] README and ROADMAP point future agents to the decision.
- [ ] Decision names the routes that should exist for MVP.
- [ ] Decision names whether Evaller data is canonical, temporary, or a subdomain.

#### Validation

- [ ] npm run lint

#### Notes

This is the first task because nearly every implementation task depends on the answer.

### TASK-002: Define canonical route and navigation contract

Status: Ready
Priority: P0
Area: UX
Depends on: TASK-001
Linear: EVL-ROUTE-001

#### Goal

Turn the product decision into an explicit route and navigation contract.

#### Scope

Document public routes, authenticated routes, redirects, left-nav labels, mobile nav labels, and project switcher behavior. No application behavior changes.

#### Acceptance Criteria

- [ ] Every current route is classified as public, authenticated, redirect, active MVP, or legacy.
- [ ] The expected behavior for `/` is explicit.
- [ ] The expected behavior for current redirected EvalOps routes is explicit.
- [ ] The contract is concrete enough to update E2E tests.

#### Validation

- [ ] npm run lint

#### Notes

This should become the reference for fixing Playwright.

### TASK-003: Document EvalOps vs Evaller data ownership boundary

Status: Ready
Priority: P0
Area: Data
Depends on: TASK-001
Linear: EVL-DATA-001

#### Goal

Clarify how the two data models relate before migrations or API changes continue.

#### Scope

Audit `src/lib/server/types.ts`, `src/lib/evaller/types.ts`, and Supabase migrations. Update docs with ownership, overlap, and future migration implications. Do not drop tables or data.

#### Acceptance Criteria

- [ ] EvalOps entities are classified as keep, legacy, or shared.
- [ ] Evaller entities are classified as keep, legacy, or shared.
- [ ] Export, billing, RLS, and reporting implications are listed.
- [ ] Any destructive migration work is deferred to separate tickets.

#### Validation

- [ ] npm run lint

#### Notes

Keep this as documentation until product direction is stable.

### TASK-004: Re-audit env and readiness configuration

Status: Ready
Priority: P0
Area: Deployment
Depends on: None
Linear: EVL-SEC-001

#### Goal

Make sure `.env.example`, readiness checks, smoke script requirements, and code references agree.

#### Scope

Search `process.env`, compare against `.env.example`, `src/lib/server/env.ts`, `/api/readiness`, and `scripts/production-smoke.mjs`. Update docs or `.env.example` only if needed.

#### Acceptance Criteria

- [ ] Every app-owned env var referenced in code is documented.
- [ ] Production-only and local-test vars are clearly marked.
- [ ] Smoke-only vars are clearly marked.
- [ ] No real secret values are added.

#### Validation

- [ ] rg "process.env|NEXT_PUBLIC_|EVALOPS_|SUPABASE_|OPENAI_|INNGEST_|STRIPE_" src scripts .env.example
- [ ] npm run lint

#### Notes

Current smoke requires `OPENAI_EVALLER_MODEL`; readiness checks also require Stripe envs.

### TASK-005: Create Supabase migration and advisor verification runbook

Status: Ready
Priority: P0
Area: Security
Depends on: TASK-003
Linear: EVL-DATA-002

#### Goal

Make remote Supabase verification repeatable before production smoke.

#### Scope

Document exact commands for migration list, migration push, database lint/advisors, Storage bucket checks, and RLS isolation checks. Do not run destructive migrations in this task.

#### Acceptance Criteria

- [ ] Runbook identifies required Supabase project and environments.
- [ ] Runbook lists advisor commands and expected pass/fail handling.
- [ ] Runbook includes two-user tenant isolation checks.
- [ ] Runbook includes private Storage object isolation checks.

#### Validation

- [ ] npm run lint

#### Notes

Requires Supabase credentials to execute later.

### TASK-006: Fix E2E expectation for root route behavior

Status: Ready
Priority: P0
Area: Testing
Depends on: TASK-002
Linear: EVL-QA-001

#### Goal

Make the root route E2E test match the canonical product contract.

#### Scope

Update either the test expectation or app behavior for `/`, based on TASK-002. Keep assertions meaningful and do not remove coverage.

#### Acceptance Criteria

- [ ] `/` behavior matches the route contract.
- [ ] Browser test asserts the intended public or authenticated behavior.
- [ ] No unrelated E2E assertions are weakened.

#### Validation

- [ ] npm run test:e2e -- tests/e2e/landing-onboarding.spec.ts
- [ ] npm run lint

#### Notes

Fresh failure: test expects `/workspace`, current app remains at `/`.

### TASK-007: Fix E2E expectation for workspace heading

Status: Ready
Priority: P0
Area: Testing
Depends on: TASK-002
Linear: EVL-QA-002

#### Goal

Align the workspace heading assertion with the active route contract.

#### Scope

Update the failing assertion or UI heading according to the canonical copy contract.

#### Acceptance Criteria

- [ ] `/workspace` has the intended heading.
- [ ] `tests/e2e/core-flow.spec.ts` starts from a stable, accessible heading.
- [ ] The core flow still tests run, fix, rerun, and report evidence.

#### Validation

- [ ] npm run test:e2e -- tests/e2e/core-flow.spec.ts
- [ ] npm run lint

#### Notes

Fresh failure: test expects `Workspace`, active UI renders `Workspace Cockpit`.

### TASK-008: Fix E2E expectation for Templates copy

Status: Ready
Priority: P0
Area: Testing
Depends on: TASK-002
Linear: EVL-QA-004

#### Goal

Align Templates E2E copy with the active product copy.

#### Scope

Update the test or UI copy according to the canonical contract. Keep coverage for applying the template and returning to workspace.

#### Acceptance Criteria

- [ ] Templates page assertion uses stable, user-visible copy.
- [ ] Applying the template still navigates to `/workspace`.
- [ ] Quality bar and settings checks still pass.

#### Validation

- [ ] npm run test:e2e -- tests/e2e/project-switching.spec.ts
- [ ] npm run lint

#### Notes

Fresh failure: test expects `More Templates Later`, which is not present.

### TASK-009: Wire `/dashboard` to the canonical dashboard view

Status: Backlog
Priority: P0
Area: UX
Depends on: TASK-001, TASK-002
Linear: EVL-FE-001

#### Goal

Make `/dashboard` render the canonical MVP dashboard instead of redirecting.

#### Scope

Use the existing EvalOps dashboard view or a focused equivalent. Preserve current Evaller routes unless the product decision says otherwise.

#### Acceptance Criteria

- [ ] `/dashboard` renders a meaningful dashboard page.
- [ ] Page includes expected heading, project context, and primary metrics/actions.
- [ ] Loading and no-project states are handled.

#### Validation

- [ ] npm run typecheck
- [ ] npm run lint
- [ ] npm test
- [ ] npm run build

#### Notes

Do this after the route contract is approved.

### TASK-010: Wire `/projects` to project selection and creation

Status: Backlog
Priority: P0
Area: UX
Depends on: TASK-001, TASK-002
Linear: EVL-FE-002

#### Goal

Make `/projects` render project list and creation controls instead of redirecting.

#### Scope

Use existing project API/store paths and existing UI patterns. Keep the task focused on project list/create/select.

#### Acceptance Criteria

- [ ] `/projects` lists existing projects.
- [ ] User can create a project with validated inputs in test mode.
- [ ] User can select an active project.
- [ ] Empty state explains next action.

#### Validation

- [ ] npm run typecheck
- [ ] npm run lint
- [ ] npm test
- [ ] npm run build

#### Notes

This is a prerequisite for most EvalOps workflow pages.

### TASK-011: Wire `/trace-import` to trace upload workflow

Status: Backlog
Priority: P0
Area: UX
Depends on: TASK-010
Linear: EVL-FE-003

#### Goal

Expose the trace import flow through its intended route.

#### Scope

Render upload controls for CSV, JSON, NDJSON, and TXT, plus job/progress/status feedback from existing APIs.

#### Acceptance Criteria

- [ ] `/trace-import` requires or prompts for an active project.
- [ ] Supported files can be selected and submitted in test mode.
- [ ] Unsupported files show user-safe errors.
- [ ] Processing status is visible.

#### Validation

- [ ] npm run typecheck
- [ ] npm run lint
- [ ] npm test
- [ ] npm run build

#### Notes

Do not add third-party imports in this task.

### TASK-012: Wire `/eval-builder` to eval case review

Status: Backlog
Priority: P0
Area: UX
Depends on: TASK-011
Linear: EVL-FE-004

#### Goal

Expose generated eval case review through the intended route.

#### Scope

Render persisted eval cases, review issues, filters, labels/status updates, and export affordance using existing APIs.

#### Acceptance Criteria

- [ ] `/eval-builder` renders generated eval cases for the active project.
- [ ] Empty state is clear before imports.
- [ ] User can update an eval case or issue status where current APIs allow.
- [ ] UI avoids exposing raw sensitive trace content.

#### Validation

- [ ] npm run typecheck
- [ ] npm run lint
- [ ] npm test
- [ ] npm run build

#### Notes

Use existing evidence UI where possible.

### TASK-013: Wire `/graders` to grader configuration

Status: Backlog
Priority: P0
Area: UX
Depends on: TASK-011
Linear: EVL-FE-005

#### Goal

Expose grader definitions and threshold editing through the intended route.

#### Scope

Render persisted graders, deterministic/LLM judge metadata, thresholds, rubrics, and calibration evidence available today.

#### Acceptance Criteria

- [ ] `/graders` renders generated graders for the active project.
- [ ] Empty state is clear before imports.
- [ ] User can save supported grader edits.
- [ ] Validation errors are visible and user-safe.

#### Validation

- [ ] npm run typecheck
- [ ] npm run lint
- [ ] npm test
- [ ] npm run build

#### Notes

Do not invent full calibration workflows beyond current backend support.

### TASK-014: Wire `/prompt-optimizer` to prompt candidate review

Status: Backlog
Priority: P0
Area: UX
Depends on: TASK-011
Linear: EVL-FE-006

#### Goal

Expose prompt version/candidate comparison through the intended route.

#### Scope

Render current prompt, candidates, evidence, quality/cost/risk metadata, and explicit promotion confirmation.

#### Acceptance Criteria

- [ ] `/prompt-optimizer` renders current prompt and candidates.
- [ ] Empty state is clear before imports/candidates exist.
- [ ] Promotion requires explicit user confirmation.
- [ ] Promotion uses existing API path.

#### Validation

- [ ] npm run typecheck
- [ ] npm run lint
- [ ] npm test
- [ ] npm run build

#### Notes

Do not auto-promote prompts.

### TASK-015: Wire `/routing-caching` to recommendations

Status: Backlog
Priority: P0
Area: UX
Depends on: TASK-011
Linear: EVL-FE-007

#### Goal

Expose routing and caching recommendations through the intended route.

#### Scope

Render intent routing rules, risk callouts, cache recommendations, savings estimates, and evidence available in current state.

#### Acceptance Criteria

- [ ] `/routing-caching` renders route and cache recommendations.
- [ ] Empty state is clear before recommendations exist.
- [ ] Recommendations include evidence or calculation basis where available.
- [ ] Layout remains usable on mobile.

#### Validation

- [ ] npm run typecheck
- [ ] npm run lint
- [ ] npm test
- [ ] npm run build

#### Notes

Keep this operational, not a generic analytics dashboard.

### TASK-016: Wire `/reports` to report and export workflows

Status: Backlog
Priority: P0
Area: UX
Depends on: TASK-011
Linear: EVL-FE-008

#### Goal

Expose executive report and export controls through the intended route.

#### Scope

Render persisted reports, risk summaries, recommendations, PDF export, CSV export, and full-project export where appropriate.

#### Acceptance Criteria

- [ ] `/reports` renders report content after a processed import.
- [ ] PDF/export buttons use existing API paths.
- [ ] Empty state is clear before reports exist.
- [ ] Download errors are visible.

#### Validation

- [ ] npm run typecheck
- [ ] npm run lint
- [ ] npm test
- [ ] npm run build

#### Notes

Downloaded artifact content is already covered by API tests; add UI smoke later.

### TASK-017: Update authenticated navigation and project switcher

Status: Backlog
Priority: P0
Area: UX
Depends on: TASK-009, TASK-010
Linear: EVL-NAV-001

#### Goal

Make navigation match the canonical MVP route set.

#### Scope

Update `src/lib/navigation.ts`, `src/components/app-shell.tsx`, and project switcher behavior to support the approved route contract.

#### Acceptance Criteria

- [ ] Desktop nav shows approved MVP routes.
- [ ] Mobile nav remains usable at 390px width.
- [ ] Active states match current route.
- [ ] Project switcher behavior is clear and persistent.

#### Validation

- [ ] npm run typecheck
- [ ] npm run lint
- [ ] npm run test:e2e

#### Notes

This may need to be split smaller if the route set is broad.

### TASK-018: Add production-mode API unauthenticated rejection coverage

Status: Ready
Priority: P0
Area: Security
Depends on: None
Linear: EVL-AUTH-002

#### Goal

Ensure APIs reject unauthenticated requests outside test mode.

#### Scope

Add focused tests for key API routes using production-mode auth assumptions and missing Supabase/session state.

#### Acceptance Criteria

- [ ] At least one EvalOps API rejects unauthenticated requests.
- [ ] At least one Evaller API rejects unauthenticated requests.
- [ ] Error shape remains user-safe and includes a correlation ID where applicable.

#### Validation

- [ ] npm test
- [ ] npm run lint

#### Notes

Do not require real Supabase credentials for this test.

### TASK-019: Run preview production smoke

Status: Blocked
Priority: P0
Area: Deployment
Depends on: TASK-004, TASK-005
Linear: EVL-SMOKE-001

#### Goal

Verify live vendor-backed operation against preview.

#### Scope

Configure required env vars outside the repo, deploy preview, run `npm run smoke:production`, and record failures.

#### Acceptance Criteria

- [ ] Smoke env vars are configured outside the repo.
- [ ] `/api/readiness` passes with token.
- [ ] Evaller smoke passes.
- [ ] EvalOps project/import/export/delete smoke passes.
- [ ] RLS and Storage isolation pass.

#### Validation

- [ ] EVALOPS_BASE_URL=<preview-url> npm run smoke:production

#### Notes

Blocked until credentials and preview deployment access are available.

### TASK-020: Verify Supabase RLS and Storage isolation on preview

Status: Blocked
Priority: P0
Area: Security
Depends on: TASK-005, TASK-019
Linear: EVL-SEC-002

#### Goal

Prove tenant data isolation with real Supabase.

#### Scope

Use two smoke users across different organizations and verify app APIs, direct Supabase client reads, and private Storage object access.

#### Acceptance Criteria

- [ ] User A cannot read User B organization/project records.
- [ ] User A cannot download User B trace/export objects.
- [ ] Service-role paths remain server-only.
- [ ] Any policy gaps are captured as follow-up tasks.

#### Validation

- [ ] EVALOPS_BASE_URL=<preview-url> npm run smoke:production

#### Notes

This is launch-blocking for customer trace data.

### TASK-021: Decide private MVP billing posture

Status: Ready
Priority: P1
Area: Other
Depends on: TASK-001
Linear: EVL-BILL-001

#### Goal

Decide whether private MVP billing is Stripe self-serve or manual/invoice-based.

#### Scope

Review existing Stripe routes and commercial docs. Document the chosen launch posture and any UI/API gates required. Do not change billing behavior in this task.

#### Acceptance Criteria

- [ ] Billing posture is documented.
- [ ] Stripe requirements are listed if enabled.
- [ ] Manual/invoice fallback is listed if Stripe is deferred.
- [ ] UI claims that need changing are identified.

#### Validation

- [ ] npm run lint

#### Notes

Requires commercial/operator input.

### TASK-022: Add raw-retention purge schedule or operator runbook

Status: Backlog
Priority: P1
Area: Security
Depends on: TASK-020
Linear: EVL-PRIV-001

#### Goal

Make raw trace retention enforcement operational.

#### Scope

Either add a monitored scheduled workflow or document an operator-safe manual runbook using existing privacy operations.

#### Acceptance Criteria

- [ ] Raw retention can be executed safely.
- [ ] Operation creates customer-visible receipts.
- [ ] Derived artifacts are preserved.
- [ ] Failure/retry behavior is documented.

#### Validation

- [ ] npm test
- [ ] npm run lint

#### Notes

Prefer Inngest scheduled function if the provider plan supports it.

### TASK-023: Define privacy-safe observability policy

Status: Ready
Priority: P1
Area: Security
Depends on: TASK-001
Linear: EVL-OBS-001

#### Goal

Decide what errors and product events can be captured without leaking raw customer content.

#### Scope

Create an observability policy for Sentry/PostHog or an equivalent stack. Do not add dependencies yet.

#### Acceptance Criteria

- [ ] Allowed and forbidden event fields are documented.
- [ ] Raw traces, prompts, and uploaded content are excluded.
- [ ] Correlation ID usage is documented.
- [ ] Follow-up implementation tasks are listed.

#### Validation

- [ ] npm run lint

#### Notes

This should precede runtime monitoring implementation.

## 8. Recommended Immediate Sprint

### Sprint task: TASK-001 - Record canonical product surface decision

Why now: It prevents wrong-direction implementation.
Expected outcome: One authoritative product decision.
Validation: `npm run lint`

### Sprint task: TASK-002 - Define canonical route and navigation contract

Why now: E2E and route work need a concrete target.
Expected outcome: Route/nav contract for app and tests.
Validation: `npm run lint`

### Sprint task: TASK-003 - Document EvalOps vs Evaller data ownership boundary

Why now: Data work is high-risk without a model boundary.
Expected outcome: Clear ownership and migration implications.
Validation: `npm run lint`

### Sprint task: TASK-004 - Re-audit env and readiness configuration

Why now: Smoke and deployment work depend on accurate env docs.
Expected outcome: Env inventory matches code.
Validation: `npm run lint`

### Sprint task: TASK-005 - Create Supabase migration and advisor verification runbook

Why now: Remote data/security verification must be repeatable.
Expected outcome: Operator-ready Supabase verification steps.
Validation: `npm run lint`

### Sprint task: TASK-006 - Fix E2E expectation for root route behavior

Why now: Current browser suite is red.
Expected outcome: Root route test matches contract.
Validation: `npm run test:e2e -- tests/e2e/landing-onboarding.spec.ts`

### Sprint task: TASK-007 - Fix E2E expectation for workspace heading

Why now: Current core-flow test fails immediately on heading lookup.
Expected outcome: Core flow starts from stable accessible heading.
Validation: `npm run test:e2e -- tests/e2e/core-flow.spec.ts`

### Sprint task: TASK-008 - Fix E2E expectation for Templates copy

Why now: Current Templates smoke is stale.
Expected outcome: Templates flow validates active copy and behavior.
Validation: `npm run test:e2e -- tests/e2e/project-switching.spec.ts`

## 9. Risks and Assumptions

### Technical risks

- Large UI components make targeted route work risky unless split carefully.
- CI will remain red while Playwright fails.
- Production smoke script is broad and may uncover multiple unrelated live-service failures at once.
- Deterministic test mode can hide production-only Supabase, OpenAI, Inngest, and Stripe issues.

### Product risks

- Active Evaller product may be more coherent than the broader EvalOps spec, but the repo docs still promise EvalOps Copilot.
- Legal pages and marketing copy may overpromise if product scope is not resolved.
- Required EvalOps routes appearing in build output can create a false sense of product completeness.

### Security risks

- Customer traces and prompts are sensitive.
- Remote RLS and Storage isolation must be verified before real customers.
- Observability must avoid raw trace, prompt, uploaded file, and secret capture.
- Billing and support paths must avoid exposing cross-tenant records.

### Deployment risks

- Preview/production env vars are not verified.
- Smoke credentials are missing locally.
- Inngest and Stripe behavior cannot be trusted until live smoke passes.
- Vercel production must never run with `EVALOPS_TEST_MODE=1`.

### Assumptions

- The intended production hosting target is Vercel.
- The intended production data provider is Supabase.
- The intended async provider is Inngest.
- The intended AI provider is OpenAI.
- The intended billing provider is Stripe if billing is enabled.
- Existing Linear export files are planning artifacts, not active Linear issues in this repo project.
- No `/handoff` route or Lovable handoff artifact exists.

## 10. Definition of Done

### MVP Ready

The product is MVP Ready when all of the following are true:

- [ ] Canonical product surface is decided and documented.
- [ ] Public landing, metadata, docs, app shell, route contract, and E2E tests match that decision.
- [ ] A signed-in user can complete the chosen core workflow in deterministic test mode.
- [ ] Required MVP routes are active, or intentionally removed from the MVP contract.
- [ ] Project/workspace selection is coherent.
- [ ] Core forms validate user input.
- [ ] Loading, empty, error, and success states exist for critical flows.
- [ ] Exports/reports produce useful artifacts or clearly scoped MVP outputs.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test:e2e` passes.

### Production Ready

The product is Production Ready when all MVP Ready items are true and all of the following are true:

- [ ] Preview and production env vars are configured outside the repo.
- [ ] Hosted environments do not use `EVALOPS_TEST_MODE=1`.
- [ ] Supabase migrations are applied and advisors are reviewed.
- [ ] Supabase Auth settings are production-hardened for the chosen launch mode.
- [ ] RLS and private Storage isolation are verified with two users.
- [ ] OpenAI generation works in production mode with privacy-safe prompts and structured outputs.
- [ ] Inngest workflows are registered, observable, and retry-safe.
- [ ] Stripe billing is either fully verified or explicitly disabled/deferred in UI and docs.
- [ ] Production smoke passes against preview.
- [ ] Health and readiness endpoints are monitored.
- [ ] Error logging/monitoring is privacy-safe and operational.
- [ ] Legal, privacy, DPA, subprocessors, billing, support, and incident copy is reviewed by the appropriate human owner.
- [ ] Raw data retention, export, and deletion operations are auditable.
- [ ] Rollback steps are documented for app deploy and data migration failures.
