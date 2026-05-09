# Linear Sync Summary

Linear updated: Project only
Linear project URL: https://linear.app/tallyrec/project/evalops-copilot-fff3ff578645
Issues created: 0
Issues updated: 0
Duplicates skipped: 0
Issues kept local only: 53
Failures: Linear issue creation is blocked by the workspace free issue limit. The project was created successfully, but the first issue creation returned: Usage limit exceeded - You've exceeded the free issue limit for this workspace.

Linear sync candidates blocked: 46
Intentionally local-only issues: 7

## Recommended First 10 Issues To Move To Ready For Plan
- EVL-PROD-001: Record canonical EvalOps vs Evaller product decision
- EVL-ROUTE-001: Create canonical route and navigation contract
- EVL-DATA-001: Document EvalOps vs Evaller data ownership boundary
- EVL-SEC-001: Re-audit env inventory against runtime checks
- EVL-DATA-002: Create Supabase migration and advisor verification runbook
- EVL-QA-001: Fix E2E expectation for root and legacy route behavior
- EVL-QA-002: Fix E2E expectation for workspace heading
- EVL-QA-003: Stabilize readiness approval E2E assertion
- EVL-QA-004: Fix templates E2E copy assertion
- EVL-AUTH-002: Add API unauthenticated rejection coverage for production mode

## Risks Before Implementation
- High: The repo may continue developing a UI that does not match the intended EvalOps Copilot MVP.
- High: RLS and private Storage isolation have tests and migrations, but latest remote state was not verified in this audit.
- High: Production AI/worker/smoke path is blocked by missing vendor credentials.
- Medium: Large UI components increase regression risk while restoring routes.

## Next Command/Prompt
Use the exact next prompt from the final assistant response or start with EVL-PROD-001 if the product decision is still open.
