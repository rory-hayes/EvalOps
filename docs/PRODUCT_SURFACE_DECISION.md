# Product Surface Decision

Date: 2026-05-09
Status: Accepted for MVP planning
Task: TASK-001 / EVL-PROD-001

## Decision

This repository ships **EvalOps Copilot** as the canonical product surface for the private MVP.

**Evaller is a sub-flow inside EvalOps Copilot**, not a standalone product and not the canonical brand. The current Evaller support-AI release-check experience should be treated as the support-assistant workflow inside the broader Eval Debt Audit product.

No application behavior changes are made by this decision record. Current Evaller routes and components remain implementation reality until follow-up route, navigation, data, and test tasks align the app to this decision.

## Rationale

- `prompt.md`, `docs/PRODUCT.md`, and the broader backend/domain model describe EvalOps Copilot and the Eval Debt Audit as the intended product.
- The first paid MVP needs project creation, trace import, eval case review, grader calibration, prompt optimization, routing/caching recommendations, and executive reporting.
- The active Evaller flow is coherent, but it is narrower than the product promise. It remains valuable as the support-AI release-readiness workflow within EvalOps Copilot.

## Canonical Name And Landing Stance

- Product name: **EvalOps Copilot**.
- Public landing: `/` should present EvalOps Copilot and the service-assisted Eval Debt Audit offer. It should not claim completed workflows until active routes support them.
- Authenticated default: `/dashboard` should become the default product entry point after sign-in.
- Current Evaller naming in metadata, app shell, landing copy, and tests is implementation drift to resolve in follow-up tasks.

## MVP Route Set

The EvalOps Copilot MVP should expose these authenticated product routes:

| Route | Canonical navigation label | MVP purpose |
| --- | --- | --- |
| `/dashboard` | Dashboard | Eval health overview, current project status, recommended next actions. |
| `/projects` | Projects | Project selection and create-project workflow for one customer AI workflow. |
| `/onboarding` | Onboarding | First-run project setup when needed; not a primary nav item after setup. |
| `/trace-import` | Trace Import | Upload, validate, preview, redact, and process traces or prompt-output pairs. |
| `/eval-builder` | Eval Builder | Review generated eval cases, datasets, tags, risk levels, and issues. |
| `/graders` | Graders | Review and calibrate deterministic and LLM-as-judge graders. |
| `/prompt-optimizer` | Prompt Optimizer | Compare prompt candidates against quality, cost, latency, and regression risk. |
| `/routing-caching` | Routing & Caching | Review model routing and prompt caching recommendations. |
| `/reports` | Reports | Produce executive audit reports, eval packs, exports, and receipts. |
| `/settings` | Settings | Privacy, retention, team, billing posture, support, and data controls. |

Public/supporting routes should remain available as needed: `/`, `/login`, `/signup`, `/auth/confirm`, `/invite/[token]`, `/terms`, `/privacy`, `/dpa`, `/subprocessors`, and `/contact`.

Current routes `/workspace`, `/runs`, and `/templates` are not canonical top-level MVP routes. They should be classified as temporary, legacy, redirect, or nested sub-flow routes by TASK-002 before behavior or tests change.

## Navigation Labels

Primary authenticated navigation should use:

- Dashboard
- Projects
- Trace Import
- Eval Builder
- Graders
- Prompt Optimizer
- Routing & Caching
- Reports

Settings should remain a secondary/admin surface. Evaller labels such as Workspace, Runs, and Templates should not remain top-level product labels unless TASK-002 explicitly keeps them as aliases or nested support-AI sub-flow labels.

## Data Model Implications

- EvalOps organization, project, trace, eval, grader, prompt, routing, report, export, billing, support, privacy, and audit-event entities are canonical for the MVP.
- Evaller `ai_test_*` data is a **subdomain** for support-AI release checks inside EvalOps Copilot. It is not disposable demo data, but it is also not the top-level canonical data model.
- Future data work should link or map Evaller AI tests, scenarios, criteria, runs, suggestions, readiness reports, comments, members, and invitations to EvalOps organization/project ownership.
- Exports, reports, billing gates, RLS policies, and privacy operations must account for Evaller subdomain data when that workflow is used.
- Do not drop or destructively migrate EvalOps or Evaller tables as part of this decision. Detailed ownership classification belongs to TASK-003.

## Follow-Up Work

- TASK-002: define the concrete route, redirect, navigation, mobile nav, and project switcher contract.
- TASK-003: document detailed EvalOps vs Evaller data ownership and migration implications.
- Later UI/test tasks: align metadata, landing copy, app shell labels, active routes, and Playwright assertions to this decision.
