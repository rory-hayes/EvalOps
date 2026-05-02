# Production Readiness Notes

## Implemented Core Flow

1. A signed-in user is resolved through Clerk when configured.
2. The backend creates or confirms a workspace, user profile, organization, and membership.
3. A user creates a tenant-scoped project.
4. A user uploads CSV, JSON, NDJSON, or TXT traces.
5. The backend stores the file in Supabase Storage in production mode or the explicit local test store in test mode.
6. The backend creates trace import, uploaded file, processing job, trace, eval case, grader, eval run, issue, report, and audit records.
7. The user can review cases and resolve, ignore, or reopen issues with comments.
8. The user can generate and download a CSV export from persisted eval cases and issues.
9. Dashboard, grader, prompt, routing, report, settings, and audit views read backend state.

## Supabase

- Migration: `supabase/migrations/20260502070158_create_evalops_core.sql`
- RLS: enabled on public tenant tables.
- Storage: `evalops-trace-uploads` and `evalops-exports` buckets are private and organization-prefixed.
- Server code uses `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`; these must never use `NEXT_PUBLIC_`.

## Supabase Remote Status

Remote project `EvalOps` (`bkjgpuhwqlbybpfkutyf`) is connected through the Supabase plugin.

Applied migrations:

1. `create_evalops_core`
2. `harden_evalops_indexes_and_rls_policies`
3. `optimize_evalops_rls_initplans`

Verification:

- Public tables created: 21.
- Private buckets created: `evalops-trace-uploads`, `evalops-exports`.
- RLS is enabled on tenant-scoped public tables.
- Supabase security advisors: no lints.
- Supabase performance advisors: only `unused_index` INFO notices remain, expected immediately after creating an empty schema before traffic/query stats accumulate.

## Deployment Status

The local checkout is not linked to a Vercel project. The May 2, 2026 audit found:

- Vercel CLI is authenticated, but this repo has no `.vercel/project.json` and the Vercel project list has no EvalOps project.
- Production Clerk environment variables and the Supabase server secret are not present locally.

Use:

```bash
supabase link --project-ref bkjgpuhwqlbybpfkutyf
supabase db push
supabase db advisors --linked
vercel link
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_SECRET_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
vercel env add SUPABASE_SECRET_KEY production
vercel env add OPENAI_API_KEY production
vercel deploy --prod
```

Do not deploy with `EVALOPS_TEST_MODE=1`; that mode is only for deterministic local and CI verification.

## Latest Local Audit

- Unit/integration tests cover trace parsing, local persistence, API flow, failed uploads, comments, exports, and tenant isolation.
- Playwright E2E covers project creation, visible file selection, trace upload/processing, issue resolution with a comment, CSV export, and audit trail visibility.
- In-app browser smoke on `http://localhost:3102` verified all primary pages render after project creation and the trace import page exposes visible file selection.
- Local Supabase migration application reached `Applying migration 20260502070158_create_evalops_core.sql` successfully before Docker failed on a local `supabase/snippets` mount permission. Remote migration push is still pending the intended project ref.

## Known Limits

- OpenAI structured generation is still isolated behind schemas and deterministic processing. The app does not call OpenAI in the browser.
- Inngest is not required for the deterministic MVP path; processing is synchronous in the API route but recorded as a durable job.
- Test mode exists only behind `EVALOPS_TEST_MODE=1`; production mode requires real Clerk and Supabase credentials.
