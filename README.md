# EvalOps Copilot

EvalOps Copilot is intended to become a private MVP SaaS for running an Eval Debt Audit on one customer-facing AI workflow: upload traces, generate and review eval assets, calibrate graders, compare prompt candidates, recommend routing/caching changes, and export an audit report.

## Current Status
This repository is buildable and has substantial backend, persistence, test, and operational code. It is not yet product-surface complete for the EvalOps Copilot MVP described in `prompt.md`.

The active app currently presents a narrower **Evaller** support-AI release-readiness loop at `/workspace`, `/runs`, `/templates`, and `/settings`. The broader EvalOps Copilot UI exists in `src/components/workspace-app.tsx` and API/store code exists for projects, trace imports, eval cases, graders, reports, exports, billing, teams, and privacy operations, but the required MVP pages mostly redirect to `/workspace`.

See `ROADMAP.md` for the productionisation backlog.

## Tech Stack
- Next.js 16 App Router
- React 19 and TypeScript
- Tailwind CSS v4
- Custom component primitives and Lucide icons
- Supabase Auth, Postgres, and Storage
- Inngest for background workflows
- OpenAI Responses API boundaries for audit/AI test generation
- Stripe billing code paths
- Vercel Analytics
- Vitest and Playwright

## Main User Flows Present
- Public landing, legal, contact, login, signup, and invite pages
- Active Evaller workspace for support-AI prompt tests
- Evaller run history, prompt suggestions, prompt version restore, review comments, and readiness approval records
- Legacy/broader EvalOps API flow for project creation, trace import, processing jobs, eval artifacts, issue review, exports, privacy operations, billing, team invites, and support requests
- Token-protected readiness endpoint and production smoke script

## Important Product Gap
`prompt.md` defines EvalOps Copilot. The active UI and metadata are branded as Evaller. Future work should first decide whether to:

1. restore/wire the broader EvalOps Copilot product surface, or
2. intentionally re-scope the repository to Evaller and update product requirements accordingly.

Do not delete either surface until that decision is explicit.

## Local Setup
Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Open `http://localhost:3000`.

For deterministic local development without live Supabase/OpenAI credentials:

```bash
EVALOPS_TEST_MODE=1 EVALOPS_TEST_STORE_PATH=.evalops/local npm run dev
```

## Environment Variables
Copy `.env.example` to `.env.local` and fill only the values needed for your mode.

Local deterministic mode requires:

```bash
EVALOPS_TEST_MODE=1
EVALOPS_TEST_STORE_PATH=.evalops/local
```

Production-like mode requires Supabase, OpenAI, and Inngest credentials. Stripe variables are required for billing flows and production readiness checks. Smoke testing requires dedicated smoke users and token values.

Never commit real secrets.

## Scripts
```bash
npm run dev              # Start Next.js locally
npm run build            # Production build
npm run start            # Serve a built app
npm run lint             # ESLint
npm run typecheck        # TypeScript no-emit check
npm test                 # Vitest unit/integration tests
npm run test:e2e         # Playwright browser tests
npm run smoke:production # Live vendor smoke, requires env
```

## Verified On 2026-05-09
- `npm install`: passed, with deprecation warnings only.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 22 files and 97 tests.
- `npm run build`: passed.
- `npm run test:e2e`: failed, 4 failed and 6 passed. Failures are documented in `docs/QA_CHECKLIST.md` and `ROADMAP.md`.
- `npm run smoke:production`: failed fast because smoke/vendor env vars were missing.

## Deployment Notes
- Vercel is the assumed hosting target.
- Supabase migrations live in `supabase/migrations`.
- Supabase local ports are configured in `supabase/config.toml`.
- Inngest endpoint is `/api/inngest`.
- Health endpoint is `/api/health`.
- Readiness endpoint is `/api/readiness` and requires `Authorization: Bearer $EVALOPS_SMOKE_TOKEN`.
- Do not deploy with `EVALOPS_TEST_MODE=1`.

## Known Limitations
- Required EvalOps MVP pages are not active as distinct screens.
- Active app navigation exposes only Workspace, Runs, Templates, and Settings.
- The product brand and route contract are inconsistent across docs, UI, metadata, tests, and components.
- Playwright E2E is currently red.
- Production smoke requires live credentials and was not executed against a deployment in this audit.
- Legal/commercial copy remains placeholder-level and needs human review before paid launch.

## Documentation
- `AGENTS.md` for future coding agents
- `ROADMAP.md` for productionisation tasks
- `docs/PRODUCT.md` for product intent and gaps
- `docs/ARCHITECTURE.md` for technical structure
- `docs/DATA_MODEL.md` for schema and persistence notes
- `docs/DESIGN_SYSTEM.md` for UI conventions
- `docs/QA_CHECKLIST.md` for validation coverage
- `docs/HANDOFF_ANALYSIS.md` for migrated handoff search results
