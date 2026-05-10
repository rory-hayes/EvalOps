# Route And Navigation Contract

Date: 2026-05-10
Status: Accepted for route and test planning
Source decision: `docs/PRODUCT_SURFACE_DECISION.md`
Scope: browser routes, redirects, authenticated navigation, mobile labels, project switching, and route-handler classification. This document records the contract only; it does not change application behavior.

## Product Contract

EvalOps Copilot is the canonical private MVP product surface. Evaller remains a support-AI release-check sub-flow inside EvalOps Copilot until later tasks either nest, alias, or retire its current top-level routes.

When current implementation and canonical intent differ, route and Playwright work should use the "Current behavior" column for tests that must pass before the corresponding implementation task lands, and the "Canonical contract" column for route/nav implementation tasks.

## Classification Tags

- **Public:** reachable without an authenticated app shell.
- **Authenticated:** protected by `src/lib/supabase/proxy.ts` when Supabase is configured; `EVALOPS_TEST_MODE=1` bypasses the browser auth redirect for deterministic tests.
- **Redirect:** route intentionally redirects instead of rendering its own screen.
- **Active MVP:** canonical EvalOps Copilot MVP route or supporting route.
- **Legacy:** current Evaller top-level route retained for the support-AI sub-flow, but not canonical top-level MVP navigation.

## Browser Route Contract

| Route | Classification | Current behavior | Canonical contract |
| --- | --- | --- | --- |
| `/` | Public, active MVP supporting | Renders the public landing page and does not redirect to `/workspace`. Current copy is Evaller-focused implementation drift. | Public EvalOps Copilot landing for the service-assisted Eval Debt Audit. It must not auto-redirect authenticated or anonymous visitors to `/workspace`. |
| `/login` | Public, redirect-capable support | Renders login when unauthenticated. In production, an already-authenticated visitor is redirected by the proxy to `/projects`, which currently redirects to `/workspace`. Current safe `next` handling only allows Evaller workspace paths. | Public login. After successful auth, the default authenticated entry should be `/dashboard`; `/onboarding` is only for a known first-run setup state. |
| `/signup` | Public support | Renders account creation. Current default `next` is `/workspace` and copy is Evaller-focused. | Public signup for EvalOps Copilot. Default post-auth entry follows the login contract. |
| `/auth/confirm` | Public, redirect support | Verifies Supabase token/code and redirects to a safe `next`, defaulting to `/onboarding`; current safe path handling sends non-Evaller routes to `/workspace`. Invalid links redirect to `/login` with an error. | Public auth callback. Safe `next` handling should include canonical authenticated MVP routes once those routes are active. |
| `/invite/[token]` | Public support | Renders an organization invite page with sign-in/sign-up links and an authenticated accept action. | Public invite landing. Accepting an invite requires an authenticated actor and should continue into the canonical authenticated app. |
| `/terms` | Public support | Renders legal terms outside the app shell. | Remains public legal/supporting content. |
| `/privacy` | Public support | Renders privacy notice outside the app shell. | Remains public legal/supporting content. |
| `/dpa` | Public support | Renders DPA placeholder outside the app shell. | Remains public legal/supporting content. |
| `/subprocessors` | Public support | Renders subprocessors placeholder outside the app shell. | Remains public legal/supporting content. |
| `/contact` | Public support | Renders contact/support page outside the app shell. | Remains public support content. |
| `/dashboard` | Authenticated, redirect, active MVP | Redirects to `/workspace`. In production unauthenticated users are redirected to `/login?next=/dashboard` before the page redirect. | Primary authenticated entry point and default post-login destination. Must render Eval Health Overview when implemented. |
| `/projects` | Authenticated, redirect, active MVP | Redirects to `/workspace`. | Project list, selected project state, and create-project workflow. |
| `/onboarding` | Authenticated, redirect, active MVP supporting | Redirects to `/workspace`. | First-run project setup when no usable project exists. Not a primary nav item after setup. |
| `/trace-import` | Authenticated, redirect, active MVP | Redirects to `/workspace`. | Upload, validate, preview, redact, and process traces or prompt-output pairs. |
| `/eval-builder` | Authenticated, redirect, active MVP | Redirects to `/workspace`. | Review generated eval cases, datasets, tags, risk levels, provenance, and issues. |
| `/graders` | Authenticated, redirect, active MVP | Redirects to `/workspace`. | Review and calibrate deterministic and LLM-as-judge graders. |
| `/prompt-optimizer` | Authenticated, redirect, active MVP | Redirects to `/workspace`. | Compare prompt candidates against quality, cost, latency, and regression risk. |
| `/routing-caching` | Authenticated, redirect, active MVP | Redirects to `/workspace`. | Review model routing and prompt caching recommendations. |
| `/reports` | Authenticated, redirect, active MVP | Redirects to `/workspace`. | Produce executive audit reports, eval packs, exports, and receipts. |
| `/settings` | Authenticated, active MVP supporting | Renders `EvallerApp view="settings"` with Evaller workspace, privacy, team, prompt-version, and server-side AI details. | Secondary/admin settings for privacy, retention, team, billing posture, support, and data controls. It should not replace primary MVP navigation. |
| `/workspace` | Authenticated, legacy | Renders `EvallerApp view="workspace"` with the heading `Workspace Cockpit`. | Retained as the support-AI release-check workspace until explicitly nested, aliased, or redirected by a later task. Not the canonical authenticated default. |
| `/runs` | Authenticated, legacy | Renders `EvallerApp view="runs"` with the heading `Runs History`. | Retained for support-AI release-check run history until the Evaller sub-flow is nested or aliased. Not canonical top-level MVP nav. |
| `/templates` | Authenticated, legacy | Renders `EvallerApp view="templates"` with the heading `Templates`. | Retained for support-AI release-check templates until the Evaller sub-flow is nested or aliased. Not canonical top-level MVP nav. |
| `/logout` | Authenticated, redirect support | `POST` signs out and redirects to `/login?message=Signed out.`; `GET` redirects to `/login`. | Remains a sign-out route/action outside primary navigation labels. |

## Current Redirected EvalOps Routes

The current redirected EvalOps routes are:

- `/dashboard`
- `/projects`
- `/onboarding`
- `/trace-import`
- `/eval-builder`
- `/graders`
- `/prompt-optimizer`
- `/routing-caching`
- `/reports`

Until the route-specific implementation tasks land, deterministic Playwright tests may assert that these routes land on `/workspace` and render the current Evaller workspace heading `Workspace Cockpit`. That redirect is a temporary compatibility behavior, not a product decision that makes `/workspace` canonical.

Once an individual route is implemented, its test should stop asserting the redirect and should assert the route-specific canonical screen instead.

## Root Route Behavior

`/` is a public landing route. The expected route behavior is:

- `page.goto("/")` stays on `/`; it must not expect `/workspace`.
- The authenticated app shell left navigation should not render on `/`.
- The page should expose public entry points such as sign in or sign up.
- Product copy should be aligned to EvalOps Copilot by a later copy/UI task; route tests should not encode Evaller as the canonical product name.

## Auth Redirect Rules

The browser proxy currently treats these path prefixes as public:

- `/`
- `/login`
- `/signup`
- `/auth/confirm`
- `/terms`
- `/privacy`
- `/dpa`
- `/subprocessors`
- `/contact`
- `/invite`

All other non-API browser routes are authenticated when Supabase public config is present. In `EVALOPS_TEST_MODE=1`, the proxy bypasses auth redirects so E2E can navigate directly.

Canonical auth behavior:

- The default authenticated product entry is `/dashboard`.
- Unknown or unsafe `next` values must not redirect off-site.
- Safe `next` values should include canonical authenticated MVP routes after those routes render real screens.

## Left Navigation Contract

Canonical desktop left navigation for EvalOps Copilot:

| Order | Route | Desktop label | Status |
| --- | --- | --- | --- |
| 1 | `/dashboard` | Dashboard | Primary MVP |
| 2 | `/projects` | Projects | Primary MVP |
| 3 | `/trace-import` | Trace Import | Primary MVP |
| 4 | `/eval-builder` | Eval Builder | Primary MVP |
| 5 | `/graders` | Graders | Primary MVP |
| 6 | `/prompt-optimizer` | Prompt Optimizer | Primary MVP |
| 7 | `/routing-caching` | Routing & Caching | Primary MVP |
| 8 | `/reports` | Reports | Primary MVP |
| Secondary | `/settings` | Settings | Admin/support |

Current implementation exposes `Workspace`, `Runs`, `Templates`, and `Settings` from `src/lib/navigation.ts`. Those labels are legacy Evaller top-level navigation and should be treated as implementation drift until the navigation update task.

## Mobile Navigation Contract

Canonical mobile navigation should expose the same route targets with compact labels and accessible names:

| Route | Mobile label |
| --- | --- |
| `/dashboard` | Dashboard |
| `/projects` | Projects |
| `/trace-import` | Import |
| `/eval-builder` | Evals |
| `/graders` | Graders |
| `/prompt-optimizer` | Prompts |
| `/routing-caching` | Routing |
| `/reports` | Reports |
| `/settings` | Settings |

The mobile implementation may use a compact header, horizontal nav, drawer, or overflow menu, but the labels above are the test contract. Labels must remain usable at 390px width without overlap.

Current mobile implementation exposes the legacy Evaller labels `Workspace`, `Runs`, `Templates`, and `Settings`.

## Project Switcher Contract

Canonical EvalOps project switching is organization-scoped and applies to authenticated MVP routes.

Expected behavior:

- A selected EvalOps project should be visible or reachable from the authenticated shell or page header on `/dashboard`, `/trace-import`, `/eval-builder`, `/graders`, `/prompt-optimizer`, `/routing-caching`, `/reports`, and `/settings`.
- `/projects` owns project creation and explicit project selection.
- Selecting a project should keep the user on the current route and refresh route data for the selected project.
- Selection should persist across reloads in local browser state using `evalops:selected-project-id` until a server-backed preference exists.
- If the stored project is missing, unauthorized, or deleted, the app should fall back to the store-selected/default project and update or clear local browser state.
- Project-required routes should show a create/select project state when no project exists; they should not silently use Evaller workspace data as a substitute.
- Organization switching is separate from project switching. The current `evalops_org_id` cookie is the organization selection mechanism and must not be treated as a project switcher.
- The current Evaller app has only a "Current workspace" summary and no project switcher. That is legacy sub-flow behavior.

## Route Handler Classification

Route handlers are not left-navigation targets, but the current route tree includes them and they are classified here for completeness.

| Routes | Classification | Expected access behavior |
| --- | --- | --- |
| `/auth/confirm`, `/logout` | Public/auth support, redirect | Auth callback and sign-out redirects. |
| `/api/health` | Public operations | Liveness response with no user session required. |
| `/api/readiness` | Token-protected operations | Requires `Authorization: Bearer $EVALOPS_SMOKE_TOKEN`. |
| `/api/stripe/webhook` | Webhook support | Requires Stripe signature validation, not browser auth. |
| `/api/inngest` | Inngest support | Inngest-managed handler for background functions. |
| `/api/app-state`, `/api/projects`, `/api/projects/[projectId]`, `/api/projects/[projectId]/imports`, `/api/projects/[projectId]/runs`, `/api/projects/[projectId]/prompt/promote`, `/api/projects/[projectId]/exports`, `/api/projects/[projectId]/settings`, `/api/eval-cases/[caseId]`, `/api/eval-cases/[caseId]/labels`, `/api/graders/[graderId]`, `/api/issues/[issueId]`, `/api/exports/[exportId]/download`, `/api/receipts/[receiptId]/download` | Authenticated, active MVP backend | EvalOps project, trace, eval, grader, prompt, report, export, receipt, and issue operations. |
| `/api/organizations`, `/api/organizations/select`, `/api/organizations/members`, `/api/organizations/members/[membershipId]`, `/api/organizations/invitations`, `/api/invitations/[token]/accept` | Authenticated, active MVP support | Organization, membership, invite, and organization-selection operations. |
| `/api/billing`, `/api/billing/checkout`, `/api/billing/portal`, `/api/support/requests` | Authenticated, active MVP support | Billing posture, checkout/portal, and support request operations. |
| `/api/evaller/workspace`, `/api/evals/run`, `/api/evals/runs`, `/api/evals/run/[runId]/apply-fix`, `/api/evals/run/[runId]/comments`, `/api/evals/run/[runId]/readiness-report/approve`, `/api/evals/run/[runId]/readiness-report/copy`, `/api/evals/prompt-versions/[promptVersionId]/restore` | Authenticated, legacy sub-flow backend | Evaller support-AI release-check operations retained until nested or aliased inside EvalOps Copilot. |

## Playwright Update Guidance

Concrete assertions that can be updated from this contract:

- Root route: assert `/` remains public and does not redirect to `/workspace`.
- Redirected EvalOps routes: assert the current redirect to `/workspace` only until each route is implemented.
- Current legacy Evaller route headings: `/workspace` is `Workspace Cockpit`, `/runs` is `Runs History`, `/templates` is `Templates`, and `/settings` is `Settings`.
- Legacy Evaller navigation labels remain `Workspace`, `Runs`, `Templates`, and `Settings` until the navigation update task changes `src/lib/navigation.ts`.
- Canonical navigation tests for Dashboard, Projects, Trace Import, Eval Builder, Graders, Prompt Optimizer, Routing & Caching, and Reports should be introduced with the navigation implementation task, not before.
