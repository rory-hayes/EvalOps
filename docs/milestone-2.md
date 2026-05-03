# EvalOps Copilot Milestone 2

Milestone 2 moves the private MVP from deterministic synchronous processing toward the real audit engine.

## Built

- Queued trace import jobs with a reusable audit processor.
- Inngest endpoint and function for production trace import processing.
- Server-only OpenAI Responses API structured generation boundary.
- Deterministic generation preserved only for explicit test mode.
- Supabase migration for expanded processing job actions, job metadata, artifact provenance columns, and PDF export type support.
- CSV eval-pack export plus production-style PDF audit report export.
- Report UI PDF export action and Playwright coverage for CSV/PDF downloads.
- Duplicate upload protection by project checksum.
- Editable project privacy/risk settings and editable generated grader configuration, both persisted and audit logged.

## Remaining Later Work

- Run remote Supabase/Vercel/Inngest/OpenAI smoke tests after production env vars and migrations are applied.
- Add organization invites and membership management beyond owner workspaces.
- Add human-label calibration depth and richer eval execution logic.
- Add audited full project export and destructive deletion background jobs.
- Add billing and third-party integrations once the audit engine is stable.

## Assumptions Kept

- Billing, SSO, third-party observability integrations, and custom SDK ingestion remain out of scope.
- Test mode stays deterministic and local for reliable CI.
- Production audit generation requires OpenAI and Inngest configuration instead of silently falling back.
