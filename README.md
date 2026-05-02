# EvalOps Copilot

EvalOps Copilot is a production-oriented private MVP for running an Eval Debt Audit on a customer-facing AI workflow. Core flows now go through API routes, durable storage, processing records, review issues, exports, and audit events.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- Clerk auth and organizations
- Supabase Postgres and Storage
- Deterministic trace parser for CSV, JSON, NDJSON, and TXT imports
- Vitest unit/integration tests and Playwright E2E tests

## Environment

Copy `.env.example` to `.env.local`.

For production-like development with real services, set:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
OPENAI_API_KEY=...
```

For deterministic local E2E without live credentials, explicitly set:

```bash
EVALOPS_TEST_MODE=1
EVALOPS_TEST_STORE_PATH=.evalops
```

Test mode uses a local durable store and local file persistence only. Production mode fails visibly if Clerk or Supabase server credentials are missing.

## Supabase Setup

```bash
supabase link --project-ref <project-ref>
supabase db push
supabase db advisors --linked
```

The committed migration creates tenant-scoped tables, enables RLS, creates storage buckets, and applies storage policies for organization-prefixed object paths.

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
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_SECRET_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
vercel env add SUPABASE_SECRET_KEY production
vercel env add OPENAI_API_KEY production
vercel deploy --prod
```

## Source Documents

- `prompt.md` is the product source of truth.
- `AGENTS.md` is the engineering guide.
- `docs/production-readiness.md` summarizes the current production-readiness state.
