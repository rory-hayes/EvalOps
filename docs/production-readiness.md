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

## Deployment Status

The local checkout is not linked to a Vercel project and is not linked to a Supabase project. Use:

```bash
supabase link --project-ref <project-ref>
supabase db push
vercel link
vercel deploy --prod
```

## Known Limits

- OpenAI structured generation is still isolated behind schemas and deterministic processing. The app does not call OpenAI in the browser.
- Inngest is not required for the deterministic MVP path; processing is synchronous in the API route but recorded as a durable job.
- Test mode exists only behind `EVALOPS_TEST_MODE=1`; production mode requires real Clerk and Supabase credentials.
