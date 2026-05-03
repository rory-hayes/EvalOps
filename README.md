# EvalOps Copilot

EvalOps Copilot is a production-oriented private MVP for running an Eval Debt Audit on a customer-facing AI workflow. Core flows now go through API routes, durable storage, processing records, review issues, exports, and audit events.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- Supabase Auth, Postgres, and Storage
- Inngest-backed trace import processing
- OpenAI Responses API structured audit generation outside test mode
- Deterministic trace parser for explicit local test mode
- CSV eval-pack export and PDF audit report export
- Editable grader configuration and project privacy/risk settings for paid-pilot review
- Vitest unit/integration tests and Playwright E2E tests

## Environment

Copy `.env.example` to `.env.local`.

For production-like development with real services, set:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
OPENAI_API_KEY=...
OPENAI_AUDIT_MODEL=gpt-5.5
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

For deterministic local E2E without live credentials, explicitly set:

```bash
EVALOPS_TEST_MODE=1
EVALOPS_TEST_STORE_PATH=.evalops
```

Test mode uses a local durable store, local file persistence, and deterministic generation only. Production mode fails visibly if Supabase, OpenAI, or Inngest credentials are missing.

## Supabase Setup

```bash
supabase link --project-ref <project-ref>
supabase db push
supabase db advisors --linked
```

The committed migrations create tenant-scoped tables, enable RLS, create storage buckets, and apply storage policies for organization-prefixed object paths. Authenticated access is based on Supabase `auth.uid()` plus durable organization membership records.

Supabase Auth email confirmations are disabled for the private MVP, so new users can sign in immediately after signup. The Supabase Site URL is `https://evalops-copilot.vercel.app`; `/auth/confirm` remains available for future magic-link, email-confirmation, or OAuth/code exchange flows.

Local Supabase ports are intentionally configured in the `554xx` range to avoid clashes with other projects:

```bash
supabase start
supabase migration list --local
supabase db lint --local --fail-on error
```

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

For a production build locally:

```bash
npm run build
npm run start -- -p 3001
```

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

## Vercel Deployment

Link the project and set the env vars above:

```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
vercel env add SUPABASE_SECRET_KEY production
vercel env add OPENAI_API_KEY production
vercel env add OPENAI_AUDIT_MODEL production
vercel env add INNGEST_EVENT_KEY production
vercel env add INNGEST_SIGNING_KEY production
vercel deploy --prod
```

Do not deploy with `EVALOPS_TEST_MODE=1`; that mode is only for deterministic local and CI verification.

## Source Documents

- `prompt.md` is the product source of truth.
- `AGENTS.md` is the engineering guide.
- `docs/production-readiness.md` summarizes the current production-readiness state.
