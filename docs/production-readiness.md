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
12. Milestone 3 adds public liveness, token-protected readiness, structured server logs, CI, and a live vendor smoke script.
13. Milestone 4 adds raw-data retention controls, full project JSON export, receipt-backed project deletion, storage cleanup, data inventory, and direct-client RLS tightening.

## Supabase

- Migrations: `supabase/migrations/20260502103457_create_evalops_core.sql`, hardening migrations, the Supabase Auth membership RLS migration, `supabase/migrations/20260503125542_milestone_2_real_audit_engine.sql`, and `supabase/migrations/20260503125628_index_artifact_provenance.sql`.
- RLS: enabled on public tenant tables.
- Auth: Supabase `auth.users` is the identity source; tenant access is derived from `auth.uid()` and `organization_memberships`.
- Email confirmations: disabled for the private MVP; signup returns an active Supabase session.
- Storage: `evalops-trace-uploads` and `evalops-exports` buckets are private and organization-prefixed.
- Storage deletion: remove uploaded files and generated exports through the Supabase Storage API, not direct SQL against storage tables.
- Server code uses `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`; these must never use `NEXT_PUBLIC_`.

Supabase Auth dashboard hardening before broader rollout:

References: [password security](https://supabase.com/docs/guides/auth/password-security), [sessions](https://supabase.com/docs/guides/auth/sessions), [MFA](https://supabase.com/docs/guides/auth/auth-mfa), and [Storage object deletion](https://supabase.com/docs/guides/storage/management/delete-objects).

1. Enable leaked-password protection.
2. Require MFA/TOTP for admin/operator accounts.
3. Set password minimum length to 8+ characters with complexity requirements.
4. Enable secure password change / reauthentication controls where available.
5. Keep invite-only or private signup policy for the private MVP.
6. Require email confirmations before any broader customer rollout.
7. Configure production SMTP instead of default shared email delivery.
8. Add captcha if self-serve signup opens.
9. Set session timebox and inactivity limits appropriate for customer data access.

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
- Supabase security advisors: Auth leaked-password protection and MFA are still warning-level Auth configuration items. They are accepted for private MVP cutover unless public self-serve signup is opened.
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
vercel env add EVALOPS_SMOKE_TOKEN production
vercel deploy --prod
```

Set the same required app envs for Preview and Production. `EVALOPS_TEST_MODE` should be absent or `0` in hosted Vercel environments. The readiness endpoint fails if `EVALOPS_TEST_MODE=1` is active in Vercel production.

## Milestone 3 Operational Endpoints

- `GET /api/health`: public liveness endpoint. It returns service/runtime metadata and no vendor details.
- `GET /api/readiness`: token-protected readiness endpoint. Call with `Authorization: Bearer $EVALOPS_SMOKE_TOKEN`; it checks production env presence, Supabase service-role Postgres access, and the `evalops-trace-uploads` / `evalops-exports` private buckets.
- Inngest endpoint: `https://<deployment>/api/inngest`; expected function: `process-trace-import`.

## Milestone 4 Privacy and Data Operations

- Raw retention: project settings expose retention-aware controls, and backend privacy operations can purge retained raw uploads while preserving derived audit artifacts and operation receipts.
- Full export: `POST /api/projects/:projectId/exports` with `{ "type": "full_project_json" }` creates a customer-owned JSON package with a manifest, data inventory, project records, storage references, and external processor notes. Download through `GET /api/exports/:exportId/download`.
- Delete receipts: `DELETE /api/projects/:projectId` requires the exact `{ "confirmationName": "<project name>" }` and returns a completed `project_delete` receipt when finished. Receipts remain organization-level evidence after project records are removed.
- Storage cleanup: project deletion removes trace-upload and export objects via the Supabase Storage API. Do not delete Storage objects by writing SQL against Supabase-managed storage tables.
- Data inventory: full exports and privacy operations report raw uploads, derived records, generated exports, receipts, and storage references so customer data handling is reviewable.
- Direct-client RLS tightening: browser/client Supabase access is expected to see only tenant-authorized project data, trace imports, and storage objects; service-role code remains server-only.

## CI and Smoke

GitHub Actions:

- `CI`: runs `npm ci`, lint, typecheck, Vitest, Next build, and Playwright.
- `Production Smoke`: manual workflow that runs `npm run smoke:production` against a supplied preview or production URL.

Required GitHub secrets for smoke:

```bash
EVALOPS_SMOKE_TOKEN
EVALOPS_SMOKE_EMAIL
EVALOPS_SMOKE_PASSWORD
EVALOPS_SMOKE_SECONDARY_EMAIL
EVALOPS_SMOKE_SECONDARY_PASSWORD
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Local or manual smoke:

```bash
EVALOPS_BASE_URL=https://<deployment-url> npm run smoke:production
```

The smoke creates non-sensitive, uniquely named smoke data and verifies:

- token-protected readiness passes;
- Supabase Auth signs in both smoke users;
- app API creates a project and uploads a trace;
- Inngest completes the processing job;
- job metadata records OpenAI generation with a response id;
- generated cases, graders, report, and PDF export exist;
- duplicate upload protection returns `409 duplicate_upload`;
- full project JSON export downloads with matching manifest, data inventory, and eval records;
- Supabase RLS and private Storage isolate smoke user A from smoke user B;
- project deletion removes the smoke project from app state and leaves a completed `project_delete` receipt.

## Latest Local Audit

- Unit/integration tests cover trace parsing, queued local persistence, OpenAI schema mapping, API flow, duplicate upload rejection, settings persistence, grader edits, failed uploads, comments, CSV/PDF exports, tenant isolation, env gates, health, and readiness.
- Playwright E2E covers project creation, visible file selection, trace upload/processing, eval issue resolution, grader editing, CSV export, PDF export, prompt promotion confirmation, settings save, gated data controls, and audit trail visibility.
- Latest verification from the production-readiness pass should include `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.
- Remote Supabase project `EvalOps` is active and has the Milestone 2 migrations applied.

## Known Limits

- OpenAI structured generation is server-only and required outside `EVALOPS_TEST_MODE=1`.
- Inngest is the production async path; explicit test mode processes the queued job inline for deterministic CI and local E2E.
- Test mode exists only behind `EVALOPS_TEST_MODE=1`; production mode requires real Supabase Auth, Supabase server credentials, OpenAI credentials, and Inngest credentials.
- Remote production smoke testing should be repeated after Vercel env vars are confirmed and Inngest/OpenAI are live.
- Third-party trace source integrations, enterprise SSO/SAML, billing, and a production-grade eval execution engine remain out of Milestone 4 scope.
- Full export and project deletion are available through audited API paths, but customer-facing copy and operator runbooks should still be reviewed before broad rollout.
- Raw retention enforcement depends on scheduled/operator invocation until a recurring purge job is configured and monitored.

## Production Cutover Checklist

1. Confirm Supabase migrations and advisors: `supabase migration list --linked`, `supabase db lint --linked --fail-on error`, and `supabase db advisors --linked`.
2. Confirm Vercel Preview and Production envs include Supabase, OpenAI, Inngest, and `EVALOPS_SMOKE_TOKEN`; confirm hosted environments do not use `EVALOPS_TEST_MODE=1`.
3. Deploy latest commit to preview and confirm `/api/health`, `/api/readiness`, and `/api/inngest`.
4. Run `EVALOPS_BASE_URL=<preview-url> npm run smoke:production`.
5. Deploy or promote to production.
6. Run `EVALOPS_BASE_URL=https://evalops-copilot.vercel.app npm run smoke:production`.
7. Confirm Inngest dashboard shows `process-trace-import`, Vercel logs show correlation ids, and Supabase contains the smoke project records.
8. If smoke fails in production, roll back to the previous Vercel production deployment and keep Supabase migrations untouched unless a migration is proven responsible.
