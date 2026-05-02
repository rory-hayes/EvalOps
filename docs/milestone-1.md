# EvalOps Copilot Milestone 1

Milestone 1 implements the private MVP shell for the Eval Debt Audit workflow described in `prompt.md` and `AGENTS.md`.

## Built

- Next.js App Router application with TypeScript and Tailwind.
- Shared SaaS layout with left navigation, project switcher, search, date picker, and account controls.
- Required MVP pages: Dashboard, Create Project, Trace Import, Eval Builder, Graders, Prompt Optimizer, Routing & Caching, Reports, and Settings.
- Reusable domain data seeded from the PRD, with Zod schemas for trace imports, eval cases, graders, and audit readiness.
- Service boundaries for Supabase, structured AI outputs, and the durable audit pipeline, ready for live credentials and Inngest functions in later milestones.

## Deliberate Milestone 1 Limits

- Clerk, Supabase, Inngest, OpenAI, Stripe, Sentry, and PostHog are represented as installed dependencies or clear adapter boundaries, but live credentials are not required for local MVP review.
- AI generation and eval execution are mocked with realistic seeded product data.
- Third-party trace integrations are shown as disabled/coming soon affordances.

## Next Milestone

1. Add Clerk organization auth and project membership.
2. Create Supabase migrations with RLS for the domain entities.
3. Wire file upload to Supabase Storage and `trace.imported` Inngest events.
4. Implement OpenAI Responses API calls for the structured generation schemas.
5. Add export endpoints for PDF, JSON eval packs, and grader definitions.
