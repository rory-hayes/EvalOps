# EvalOps Copilot Milestone 1

Milestone 1 has moved from a static shell to a production-like core flow.

## Built

- Next.js App Router application with TypeScript and Tailwind.
- Clerk-aware auth boundary with explicit local test mode fallback.
- Supabase migration for organizations, memberships, projects, trace imports, uploads, traces, eval cases, graders, issues, comments, jobs, exports, reports, and audit events.
- Supabase Storage buckets and tenant-prefixed storage policies.
- API routes for workspace state, project creation, trace upload/processing, issue review, eval reruns, prompt promotion, exports, and downloads.
- Frontend pages connected to backend state with loading, empty, error, success, and retry paths.
- Deterministic trace parser and eval artifact generator for testing the audit workflow without client-only success states.

## Remaining Milestone 2 Work

- Link and push migrations to the intended Supabase project.
- Link and deploy to the intended Vercel project.
- Add Clerk organization creation UI if the production Clerk tenant does not create organizations before app entry.
- Replace deterministic generation with OpenAI Responses API structured outputs in the existing service boundary.
- Move long-running processing to Inngest when imports grow beyond browser-friendly files.
