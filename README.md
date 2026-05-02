# EvalOps Copilot

EvalOps Copilot is a private MVP for running an Eval Debt Audit on a customer-facing AI workflow. It turns prompts, traces, requirements, and known failures into a maintainable evaluation system with coverage, graders, prompt recommendations, routing, caching, and report surfaces.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Zod
- Clerk, Supabase, Inngest, OpenAI, and Stripe dependencies installed for later service wiring

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

For a production-like local run:

```bash
npm run build
npm run start -- -p 3001
```

Open `http://localhost:3001`.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Source Documents

- `prompt.md` is the product source of truth.
- `AGENTS.md` is the engineering guide.
- `docs/evalops_copilot_prd.md` preserves the PRD.
- `docs/milestone-1.md` summarizes this build and the next milestone.
