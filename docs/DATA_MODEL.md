# Data Model

## Current Inferred Data Model
The repo has two related data models.

### EvalOps Copilot Model
Defined in `src/lib/server/types.ts`, `src/lib/domain/audit.ts`, `src/lib/domain/trace-processing.ts`, and `supabase/migrations`.

Core entities:
- Organization
- UserProfile
- OrganizationMembership
- OrganizationBilling
- OrganizationInvitation
- SupportRequest
- Project
- TraceImport
- UploadedFile
- StoredTrace
- ProcessingJob
- Intent
- EvalDataset
- EvalCase
- Grader
- HumanLabel
- GraderCalibrationRun
- GraderCalibrationResult
- EvalRun
- EvalResult
- ReviewIssue
- IssueComment
- FailureCluster
- PromptVersion
- PromptCandidate
- RoutingRule
- CacheRecommendation
- Report
- ExportRecord
- DataOperationReceipt
- AuditEvent

### Active Evaller Model
Defined in `src/lib/evaller/types.ts` and the `ai_test_*` migrations.

Core entities:
- EvallerAiTest
- EvallerPromptVersion
- EvallerScenario
- EvallerSuccessCriterion
- EvallerRunSummary
- EvallerScenarioResult
- EvallerFailurePattern
- EvallerPromptSuggestion
- EvallerReadinessReportRecord
- EvallerReviewComment
- EvallerWorkspaceMember
- EvallerWorkspaceInvitation

## Actual Schema Files
Supabase migrations:
- `supabase/migrations/20260502103457_create_evalops_core.sql`
- `supabase/migrations/20260502103644_harden_evalops_indexes_and_rls_policies.sql`
- `supabase/migrations/20260502103744_optimize_evalops_rls_initplans.sql`
- `supabase/migrations/20260502111619_switch_rls_to_supabase_memberships.sql`
- `supabase/migrations/20260503125542_milestone_2_real_audit_engine.sql`
- `supabase/migrations/20260503125628_index_artifact_provenance.sql`
- `supabase/migrations/20260503194038_milestone_4_privacy_data_rights_security.sql`
- `supabase/migrations/20260503210000_milestone_5_eval_quality_evidence.sql`
- `supabase/migrations/20260504090000_milestone_6_commercial_saas.sql`
- `supabase/migrations/20260504120000_evaller_core_loop.sql`
- `supabase/migrations/20260504161000_evaller_release_workflow.sql`

Supabase local config:
- `supabase/config.toml`
- `supabase/seed.sql`

`supabase/seed.sql` intentionally does not seed customer data.

## Mock/Demo Data Locations
- Deterministic EvalOps local store: `src/lib/server/local-store.ts`
- Deterministic Evaller local store: `src/lib/evaller/local-store.ts`
- Evaller default support template: `src/components/evaller/evaller-app.tsx`
- E2E-generated local data: `.evalops/e2e` during Playwright runs
- Static landing screenshots: `public/landing/*`

## Hardcoded Demo Data
The active Evaller UI has a hardcoded support-AI release check template with scenarios and success criteria. This is useful for deterministic onboarding but should be treated as sample data, not customer data.

The broader EvalOps local store can create deterministic workspace/project state for test mode. Keep this behavior explicit behind `EVALOPS_TEST_MODE=1`.

## Missing Or Unclear Persistence
- Product direction is unclear between EvalOps project-based data and Evaller AI-test data.
- Required EvalOps MVP pages are not active, so it is hard to verify full UI persistence for those entities through the browser.
- Recurring raw trace purge exists as backend privacy operation logic, but a monitored schedule is not configured.
- Real production smoke could not be run in this audit because vendor/smoke env vars were missing.

## User/Org/Workspace Model
- Supabase `auth.users` is the production identity source.
- App-level profiles and organizations are stored in public tables.
- Tenant access is based on `organization_memberships`.
- `ActorContext` carries `userId`, `email`, and optional `organizationId`.
- Production APIs resolve the actor from Supabase Auth.
- Test mode uses deterministic actor headers/defaults.
- Organization selection can be stored in the `evalops_org_id` cookie.

## Row-Level Security And Security Assumptions
- RLS is enabled on tenant-scoped public tables.
- Policies generally allow authenticated organization members to manage tenant records.
- Storage policies use organization-prefixed paths for private buckets.
- Server-side Supabase service credentials are required for production store operations.
- Direct browser use of service-role keys is forbidden.
- RLS and storage isolation are covered by tests and smoke intent, but live remote verification was not completed in this audit.

## Migration Requirements
Before production cutover:
1. Confirm all committed migrations are applied to the target Supabase project.
2. Run Supabase database lint/advisors against linked preview and production projects.
3. Decide whether both EvalOps and Evaller schemas remain permanent.
4. Add migration notes for any model consolidation.
5. Verify private buckets and object policies exist.
6. Verify smoke users are isolated across organizations.

## Data Lifecycle
Expected lifecycle:
1. User creates an organization/workspace and project or AI test.
2. User uploads traces or enters scenarios/prompts.
3. Raw inputs are stored with explicit retention metadata.
4. Redacted/derived artifacts are generated.
5. Eval cases, graders, results, reports, prompts, recommendations, and audit events persist.
6. Exports/downloads create receipts.
7. Project deletion and raw purge workflows leave operation receipts.

Current lifecycle gap: scheduled/operator execution for raw purge needs to be made explicit and monitored.

## Open Questions
- Should the Evaller `ai_test_*` tables become a submodule inside EvalOps, or replace the EvalOps project model?
- What is the canonical project/workspace switcher for the MVP?
- Which records must be included in a customer export for the first paid audit?
- What retention default is legally and commercially acceptable?
- Should billing state gate private MVP usage or remain manual/invoice-based?
- What data should be captured by analytics once PostHog is enabled?
