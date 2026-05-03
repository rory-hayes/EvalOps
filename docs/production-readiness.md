# Production Readiness Notes

## Implemented Core Flow

1. A signed-in user is resolved through Supabase Auth when configured.
2. The backend creates or confirms a workspace, user profile, organization, and membership.
3. A user creates a tenant-scoped project.
4. A user uploads CSV, JSON, NDJSON, or TXT traces.
5. The backend rejects duplicate project uploads by checksum, then stores the file in Supabase Storage in production mode or the explicit local test store in test mode.
6. The backend creates a queued trace import job and sends an Inngest processing event in production.
7. The audit processor parses/redacts traces, calls OpenAI structured generation outside test mode, and persists trace, eval case, grader, eval run, issue, routing, caching, report, and audit records.
8. The user can review cases and resolve, ignore, or reopen issues with comments.
9. The user can edit generated grader configuration and project privacy/risk settings; both paths persist and emit audit events.
10. The user can generate and download a CSV eval pack or PDF audit report.
11. Dashboard, grader, prompt, routing, report, settings, and audit views read backend state.

## Supabase

- Migrations: `supabase/migrations/20260502103457_create_evalops_core.sql`, hardening migrations, the Supabase Auth membership RLS migration, and `supabase/migrations/20260503114958_milestone_2_real_audit_engine.sql`.
- RLS: enabled on public tenant tables.
- Auth: Supabase `auth.users` is the identity source; tenant access is derived from `auth.uid()` and `organization_memberships`.
- Email confirmations: disabled for the private MVP; signup returns an active Supabase session.
- Storage: `evalops-trace-uploads` and `evalops-exports` buckets are private and organization-prefixed.
- Server code uses `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`; these must never use `NEXT_PUBLIC_`.

## Supabase Remote Status

Remote project `EvalOps` (`bkjgpuhwqlbybpfkutyf`) is connected through the Supabase plugin.

Applied migrations:

1. `create_evalops_core`
2. `harden_evalops_indexes_and_rls_policies`
3. `optimize_evalops_rls_initplans`
4. `switch_rls_to_supabase_memberships`
5. `milestone_2_real_audit_engine`
6. `index_artifact_provenance`

Verification:

- Public tables created: 21.
- Private buckets created: `evalops-trace-uploads`, `evalops-exports`.
- RLS is enabled on tenant-scoped public tables.
- Supabase security advisors: Auth leaked-password protection and MFA are still warning-level Auth configuration items.
- Supabase performance advisors: only `unused_index` INFO notices remain, expected immediately after creating a new schema before traffic/query stats accumulate.

## Deployment Status

The local checkout is linked to Vercel project `evalops-copilot`, connected to GitHub repo `rory-hayes/EvalOps`, production branch `main`.

Use:

```bash
supabase link --project-ref bkjgpuhwqlbybpfkutyf
supabase db push
supabase db advisors --linked
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

## Latest Local Audit

- Unit/integration tests cover trace parsing, queued local persistence, OpenAI schema mapping, API flow, duplicate upload rejection, settings persistence, grader edits, failed uploads, comments, CSV/PDF exports, and tenant isolation.
- Playwright E2E covers project creation, visible file selection, trace upload/processing, eval issue resolution, grader editing, CSV export, PDF export, prompt promotion confirmation, settings save, gated data controls, and audit trail visibility.
- Latest verification from the production-readiness pass: `npm test` (7 files, 33 tests), `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e` (4 browser tests) pass locally.
- Remote Supabase project `EvalOps` is active and has the Milestone 2 migrations applied.

## Known Limits

- OpenAI structured generation is server-only and required outside `EVALOPS_TEST_MODE=1`.
- Inngest is the production async path; explicit test mode processes the queued job inline for deterministic CI and local E2E.
- Test mode exists only behind `EVALOPS_TEST_MODE=1`; production mode requires real Supabase Auth, Supabase server credentials, OpenAI credentials, and Inngest credentials.
- Remote production smoke testing should be repeated after Vercel env vars are confirmed and Inngest/OpenAI are live.
- Full project export and destructive project deletion remain gated until they run through audited background jobs with confirmation receipts.
