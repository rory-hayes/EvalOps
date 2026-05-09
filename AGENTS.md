# AGENTS.md

## Project Summary
EvalOps Copilot is intended to be a private MVP SaaS for running an Eval Debt Audit on customer-facing AI workflows. The product source of truth is `prompt.md`: create projects, import traces, generate eval cases and graders, review failures, optimize prompts, recommend routing/caching, and produce executive reports.

Current repo reality: the codebase contains both a broad EvalOps Copilot implementation path and a narrower active Evaller support-AI release-check UI. Do not assume these are aligned. Read the docs below before changing product behavior.

## Required Reading Before Code Changes
- `README.md`
- `ROADMAP.md`
- `prompt.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCT.md`
- `docs/DATA_MODEL.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/QA_CHECKLIST.md`
- `docs/HANDOFF_ANALYSIS.md`

## Setup Commands
Use npm. This repo has `package-lock.json`.

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run smoke:production
```

Local deterministic mode, used by Playwright and useful without live Supabase/OpenAI credentials:

```bash
EVALOPS_TEST_MODE=1 EVALOPS_TEST_STORE_PATH=.evalops/local npm run dev
```

## Development Rules
- Keep changes small, reviewable, and verifiable.
- Treat `prompt.md` as product intent and `ROADMAP.md` as the current execution backlog.
- Do not introduce fake production plumbing or success states that hide missing services.
- Do not commit secrets. Add or update `.env.example` only.
- Prefer typed, validated data paths with Zod schemas for request bodies and core entities.
- Protect authenticated product routes and server APIs.
- Keep UI consistent with `docs/DESIGN_SYSTEM.md`.
- Update `ROADMAP.md` after meaningful changes or newly discovered gaps.
- Add tests for meaningful logic changes where the current Vitest or Playwright harness applies.
- Do not delete the legacy EvalOps or active Evaller surfaces until the product direction is explicitly decided.

## Architecture Rules
- Framework: Next.js App Router with TypeScript.
- Styling: Tailwind CSS v4 plus custom primitives in `src/components/primitives.tsx`; no shadcn package is currently installed.
- Auth: Supabase Auth through `@supabase/ssr`; `src/proxy.ts` refreshes sessions and protects non-public pages when Supabase is configured.
- Persistence: production mode uses Supabase Postgres and Storage; explicit test mode uses local durable JSON/file stores under `.evalops`.
- Async: Inngest functions live in `src/lib/inngest/functions.ts`.
- AI: OpenAI server-side calls are isolated under `src/lib/ai` and `src/lib/evaller/ai.ts`; deterministic paths are allowed only under `EVALOPS_TEST_MODE=1`.
- Billing: Stripe code exists but launch posture is not production-complete until smoke tests and commercial decisions are verified.

## Key Files
- Active public and product routes: `src/app`
- Active Evaller UI: `src/components/evaller/evaller-app.tsx`
- Legacy/broader EvalOps UI: `src/components/workspace-app.tsx`
- Shared shell/navigation: `src/components/app-shell.tsx`, `src/lib/navigation.ts`
- API routes: `src/app/api`
- Server store contracts: `src/lib/server/types.ts`
- EvalOps stores: `src/lib/server/local-store.ts`, `src/lib/server/supabase-store.ts`
- Evaller stores: `src/lib/evaller/local-store.ts`, `src/lib/evaller/supabase-store.ts`
- Domain schemas/helpers: `src/lib/domain`, `src/lib/server/schemas.ts`
- Supabase schema: `supabase/migrations`
- E2E tests: `tests/e2e`

## UI Rules
- Keep the app calm, professional, and B2B-oriented.
- Prefer clear page headers, dense but readable panels, concise tables, and meaningful empty/loading/error states.
- Use the existing blue accent, slate neutrals, 7-8px radii, Geist typography, and Lucide icons.
- Avoid decorative motion, loud color, marketing-style dashboard clutter, or toy-feeling placeholders.
- If reviving the EvalOps pages, keep the shared left navigation and project switcher coherent across all required MVP screens.

## Data, Auth, And Security Rules
- Model tenant data with organization/project ownership and explicit membership checks.
- Never expose service-role keys or OpenAI/Stripe/Inngest secrets to the browser.
- Prefer derived eval artifacts over raw trace retention.
- Keep redaction, raw retention, export, and deletion flows visible and auditable.
- Do not log raw traces, prompts, or sensitive customer content casually.
- Treat Supabase RLS and private Storage policies as production-critical.

## Testing And Validation
Before handing off code changes, run the narrowest relevant checks and the full suite when behavior changes:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`npm run smoke:production` requires real smoke credentials and should fail fast when they are absent. Do not treat a missing-env smoke failure as app verification.

## Known Risks
- Active product routes expose Evaller, while `prompt.md` expects EvalOps Copilot.
- Required EvalOps MVP routes currently redirect to `/workspace` instead of rendering distinct workflows.
- `src/components/workspace-app.tsx` contains broad EvalOps UI but is not wired into active pages.
- Playwright E2E currently fails against the active UI/route contract.
- Production smoke cannot run without configured Supabase/OpenAI/Inngest/Stripe smoke env vars.
