# Architecture

## App Architecture
The repo is a Next.js App Router application with two product layers:

- **Active Evaller layer:** `src/components/evaller/evaller-app.tsx`, `src/lib/evaller/*`, and API routes under `/api/evaller` and `/api/evals/run*`.
- **Broader EvalOps layer:** `src/components/workspace-app.tsx`, `src/lib/server/*`, `src/lib/domain/*`, `src/lib/workflows/*`, and API routes for projects, imports, graders, issues, exports, organizations, billing, support, health, and readiness.

This split is the main architecture risk. It is not yet clear whether Evaller is the new product scope or a migrated subset sitting on top of the original EvalOps Copilot code.

## Frontend Routing
Public routes:
- `/`
- `/login`
- `/signup`
- `/auth/confirm`
- `/terms`
- `/privacy`
- `/dpa`
- `/subprocessors`
- `/contact`
- `/invite/[token]`

Active product routes:
- `/workspace` renders `EvallerApp view="workspace"`.
- `/runs` renders `EvallerApp view="runs"`.
- `/templates` renders `EvallerApp view="templates"`.
- `/settings` renders `EvallerApp view="settings"`.

Legacy/intended EvalOps MVP routes that currently redirect to `/workspace`:
- `/dashboard`
- `/projects`
- `/trace-import`
- `/eval-builder`
- `/graders`
- `/prompt-optimizer`
- `/routing-caching`
- `/reports`
- `/onboarding`

Shared shell/navigation:
- `src/components/app-shell.tsx`
- `src/lib/navigation.ts`

The active navigation exposes Workspace, Runs, Templates, and Settings only.

## Backend/API Architecture
API routes live under `src/app/api`.

Core patterns:
- `src/lib/server/api.ts` wraps responses in `{ ok, data, correlationId }` or `{ ok: false, error }`.
- `src/lib/server/auth.ts` resolves an actor from Supabase Auth or explicit test-mode headers.
- Request schemas live in `src/lib/server/schemas.ts`.
- EvalOps store contract lives in `src/lib/server/types.ts`.
- Evaller store contract lives in `src/lib/evaller/types.ts`.

Important API groups:
- App state/projects/imports: `/api/app-state`, `/api/projects`, `/api/projects/[projectId]/*`
- Eval artifacts: `/api/eval-cases/*`, `/api/graders/*`, `/api/issues/*`, `/api/evals/runs`
- Evaller loop: `/api/evaller/workspace`, `/api/evals/run`, `/api/evals/run/[runId]/*`
- Organizations/team: `/api/organizations/*`, `/api/invitations/[token]/accept`
- Billing/support: `/api/billing/*`, `/api/stripe/webhook`, `/api/support/requests`
- Exports/receipts: `/api/exports/[exportId]/download`, `/api/receipts/[receiptId]/download`
- Ops: `/api/health`, `/api/readiness`, `/api/inngest`

## Auth/Session Architecture
Supabase Auth is the production identity provider. `src/proxy.ts` delegates to `src/lib/supabase/proxy.ts`, which:
- refreshes Supabase sessions when public Supabase config is present;
- allows public paths unauthenticated;
- redirects unauthenticated non-API app routes to `/login`;
- skips protection in explicit `EVALOPS_TEST_MODE=1`.

Server API actor resolution uses `getActorFromRequest`. In test mode it accepts deterministic test headers; in production it requires Supabase `auth.getUser()`.

Organization selection is stored in an `evalops_org_id` cookie by `/api/organizations/select`.

## Database/Storage Architecture
Production persistence is Supabase Postgres plus Supabase Storage. Local deterministic mode uses `.evalops` file-backed stores.

Supabase migrations define:
- core EvalOps tables for organizations, memberships, projects, trace imports, uploads, traces, eval cases, graders, review issues, comments, eval runs, failures, prompts, routing/caching, reports, exports, audit events;
- eval result and calibration tables;
- billing, usage, invites, and support tables;
- Evaller AI test tables;
- privacy/data operation receipt tables;
- private Storage bucket policies for trace uploads and exports.

RLS is enabled on tenant-scoped public tables. Service-role access is server-only.

## Third-Party Integrations
- Supabase: auth, Postgres, Storage.
- OpenAI: server-side Responses API boundaries for audit generation and Evaller scoring/suggestions.
- Inngest: trace import processing, full project export, project deletion.
- Stripe: checkout, portal, webhook sync, billing state.
- Vercel Analytics: included in root layout.
- Sentry/PostHog: env placeholders exist, but no confirmed runtime implementation in this audit.

## AI/Model Usage
AI boundaries are isolated:
- `src/lib/ai/openai-audit-generation.ts`
- `src/lib/ai/llm-judge-execution.ts`
- `src/lib/evaller/ai.ts`

OpenAI is required outside explicit test mode. Test mode uses deterministic generation/scoring for reliable local and CI runs.

## Background Jobs
Inngest functions live in `src/lib/inngest/functions.ts`:
- `process-trace-import`
- `process-full-project-export`
- `process-project-deletion`

Test mode runs equivalent work inline or through local stores where implemented.

## Deployment Architecture
Assumptions:
- Vercel hosts the Next.js app.
- Supabase hosts Auth/Postgres/Storage.
- Inngest hosts background workflow execution.
- Stripe handles billing if enabled.
- Production readiness is checked through `/api/readiness` with `EVALOPS_SMOKE_TOKEN`.
- Live smoke is run through `scripts/production-smoke.mjs`.

## Known Architecture Gaps
- Product architecture is split between active Evaller and intended EvalOps.
- Broad EvalOps UI is currently not wired into required MVP routes.
- E2E route/UI assertions do not match current active behavior.
- Some docs claim production maturity that has not been re-verified against current active product surface.
- Recurring raw retention purge is not configured as a monitored cron/job.
- Sentry/PostHog are placeholders rather than verified operational integrations.
- Command-centre Google Sheet sync is not configured in this environment.

## Recommended Target Architecture
1. Decide product surface: EvalOps Copilot or Evaller.
2. If EvalOps Copilot remains the goal, wire `WorkspaceApp` or a refactored equivalent into the required MVP routes and shared navigation.
3. Consolidate overlapping EvalOps/Evaller domain models or document the boundary explicitly.
4. Keep store interfaces and API schemas as the contract between UI and persistence.
5. Keep OpenAI calls isolated in service modules with structured schemas.
6. Keep deterministic local mode for tests, but make production credential failures visible.
7. Add monitored production workflows for raw retention purge, smoke testing, and error reporting.
