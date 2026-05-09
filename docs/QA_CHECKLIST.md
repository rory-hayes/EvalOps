# QA Checklist

## Latest Audit Results
Run date: 2026-05-09.

| Command | Result | Notes |
| --- | --- | --- |
| `npm install` | Passed | Installed 685 packages. Deprecation warnings for `serialize-error-cjs@0.1.4` and `node-domexception@1.0.0`. 0 vulnerabilities. |
| `npm run lint` | Passed | ESLint completed with no reported issues. |
| `npm run typecheck` | Passed | `tsc --noEmit` completed. |
| `npm test` | Passed | 22 test files, 97 tests passed. |
| `npm run build` | Passed | Next.js production build completed and generated 43 app routes. |
| `npm run test:e2e` | Failed | 4 failed, 6 passed. See failure notes below. |
| `npm run smoke:production` | Failed fast | Missing required smoke/vendor env vars; no live deployment verification performed. |

## Current E2E Failures
1. `tests/e2e/core-flow.spec.ts` expects heading `Workspace`, but active `/workspace` renders `Workspace Cockpit`.
2. `tests/e2e/flow-hardening.spec.ts` does not observe `Readiness report approved.` after approval click.
3. `tests/e2e/landing-onboarding.spec.ts` expects `/` to redirect to `/workspace`, but `/` now serves a public landing page.
4. `tests/e2e/project-switching.spec.ts` expects `More Templates Later`, which is not present in the active Templates UI.

Likely cause: E2E tests and active UI route/copy contract have drifted. This blocks reliable CI until product direction and test expectations are reconciled.

## Smoke Test Checklist
- [ ] Start local app in deterministic mode.
- [ ] Visit `/` and confirm intended public or authenticated behavior.
- [ ] Visit `/login` and `/signup`.
- [ ] Visit `/workspace`.
- [ ] Verify authenticated app shell/nav loads.
- [ ] Verify refresh and sign-out controls render.
- [ ] Verify `/api/health` returns liveness.
- [ ] Verify `/api/readiness` rejects missing/invalid token.
- [ ] Verify no raw secrets are visible in rendered pages or client responses.

## Critical User Journey Tests
### EvalOps Copilot Intended MVP
- [ ] Create project.
- [ ] Switch active project.
- [ ] Upload CSV trace file.
- [ ] Upload JSON/NDJSON trace file.
- [ ] Upload TXT/conversation trace file.
- [ ] See schema preview and validation feedback.
- [ ] See redaction controls/status.
- [ ] See generated eval cases.
- [ ] Edit an eval case.
- [ ] Edit grader thresholds/rubric.
- [ ] Run baseline evaluation.
- [ ] Resolve/ignore/reopen review issue.
- [ ] Promote or reject prompt candidate.
- [ ] Export eval pack CSV.
- [ ] Export audit report PDF.
- [ ] Request full project export.
- [ ] Delete project with confirmation receipt.

### Active Evaller Flow
- [ ] Edit AI test name and description.
- [ ] Edit AI instructions.
- [ ] Add/remove scenarios.
- [ ] Add/remove success criteria.
- [ ] Validate quality bar.
- [ ] Save/autosave workspace.
- [ ] Run AI test.
- [ ] Apply suggested prompt fix.
- [ ] Run again and compare result.
- [ ] Add review comment.
- [ ] Approve or request changes on readiness report.
- [ ] Restore prompt version.

## Auth Tests
- [ ] Unauthenticated app route redirects to `/login` when Supabase is configured.
- [ ] Public routes stay public.
- [ ] API routes reject unauthenticated requests outside test mode.
- [ ] Signup validates email/password.
- [ ] Login validates email/password.
- [ ] Auth callback respects safe `next` values.
- [ ] Organization selection cookie cannot grant unauthorized tenant access.

## Data Persistence Tests
- [ ] Local test mode persists deterministic data in configured `.evalops` path.
- [ ] Production mode fails visibly when Supabase service config is missing.
- [ ] Supabase project creation persists organization/project records.
- [ ] Trace import creates upload/import/job records.
- [ ] Generated artifacts persist with project and organization IDs.
- [ ] Exports create download records and receipts.
- [ ] Deletion/purge workflows leave receipts.

## Route Protection Tests
- [ ] `/workspace`, `/runs`, `/templates`, `/settings` protection matches intended auth policy.
- [ ] Required MVP routes either render product screens or intentionally redirect with documented rationale.
- [ ] Public legal/contact pages are unauthenticated.
- [ ] `/api/readiness` requires bearer token.
- [ ] Stripe webhook validates signatures.
- [ ] Inngest endpoint uses configured signing/event keys in production.

## Form Validation Tests
- [ ] Project name/objective/risk/privacy fields.
- [ ] Trace file type and size.
- [ ] Eval case user input, expected behavior, criteria, and status.
- [ ] Grader thresholds and rubric.
- [ ] Human labels.
- [ ] Prompt promotion candidate ID.
- [ ] Organization invitation email/role.
- [ ] Support request subject/message/type/priority.
- [ ] Billing checkout return URL.

## Responsive Checks
- [ ] 390px mobile width.
- [ ] 768px tablet width.
- [ ] 1280px desktop width.
- [ ] Long route names/nav labels do not overlap.
- [ ] Tables remain usable.
- [ ] Modals/dialogs fit small screens.
- [ ] Upload and export controls are reachable on mobile.

## Accessibility Checks
- [ ] Keyboard-only navigation through primary workflows.
- [ ] Visible focus states.
- [ ] Inputs have accessible labels.
- [ ] Icon-only buttons have labels.
- [ ] Status/risk is not conveyed by color alone.
- [ ] Error messages are associated with the relevant action.
- [ ] Dialogs trap focus and can be dismissed safely.
- [ ] Landmark structure is sensible.

## Deployment Checks
- [ ] `EVALOPS_TEST_MODE` absent or `0`.
- [ ] Supabase URL/publishable key set.
- [ ] Supabase server key set and server-only.
- [ ] OpenAI API key/model vars set.
- [ ] Inngest keys set.
- [ ] Stripe keys/prices/webhook secret set if billing is enabled.
- [ ] Readiness smoke token set.
- [ ] Supabase migrations applied.
- [ ] Storage buckets and policies exist.
- [ ] `/api/health` works.
- [ ] `/api/readiness` works with token.
- [ ] Inngest functions registered.
- [ ] Production smoke passes against preview before production.

## Regression Checklist
- [ ] Lint, typecheck, unit/integration tests, build, and E2E pass.
- [ ] Product route contract matches tests.
- [ ] Public landing copy matches active product scope.
- [ ] No new secrets or generated local data committed.
- [ ] `.env.example` includes any new env vars.
- [ ] `ROADMAP.md` updated when tasks are completed or new gaps are found.
