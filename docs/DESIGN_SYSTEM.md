# Design System

## Visual Style Summary
The product should feel calm, premium, trustworthy, and operational. It is a B2B SaaS/workflow tool, not a playful demo. The current UI uses a light theme, slate neutrals, blue accents, compact cards, and Lucide icons.

## Layout Patterns
- Left navigation for authenticated app routes on desktop.
- Sticky top header with current route context and refresh/sign-out controls.
- Mobile bottom-ish/top compact navigation via the sticky header.
- Page headers with title, short description, optional actions, and project/meta context.
- Cards for individual panels, repeated items, and framed tools only.
- Tables and dense lists for operational review.
- Avoid nesting cards inside cards.

## Typography
- Geist Sans and Geist Mono are configured in `src/app/layout.tsx`.
- Use professional, readable hierarchy.
- Hero-scale type belongs only on public landing/hero sections.
- App panels should use compact headings and clear labels.
- Letter spacing should stay normal.

## Colour Usage
Current palette:
- Primary accent: blue.
- Neutrals: slate/white.
- Success: emerald/green for genuinely healthy states.
- Warning: amber/orange for review, risk, or incomplete states.
- Failure: red for blocking errors, failed checks, or destructive actions.
- Violet appears in some active UI tone helpers; use sparingly.

Avoid one-note palettes, loud gradients, and decorative blobs. Public landing currently uses dark hero overlay imagery; app surfaces should remain light and work-focused.

## Spacing And Shape
- Cards and controls generally use 7-8px radii.
- Controls should have stable heights and predictable spacing.
- Keep forms and tables scan-friendly.
- Use whitespace to clarify groups, not to create sparse marketing layouts inside the app.

## Components
Existing reusable primitives:
- `Card`
- `Button`
- `LinkButton`
- `Badge`
- `IconTile`
- `PageHeader`
- `ProgressBar`
- `RowLink`

Location: `src/components/primitives.tsx`.

The repo does not currently include shadcn/ui package components despite earlier stack preferences. If shadcn is added later, do it deliberately and avoid restyling unrelated surfaces in the same change.

## Empty States
Empty states should:
- name what is missing;
- explain the next action;
- include one clear CTA when useful;
- avoid implying production generation has completed when no data exists.

Key empty states to verify:
- no project;
- no trace import;
- no generated eval cases;
- no runs;
- no reports/exports;
- no team invitations.

## Loading States
Loading states should be visible for:
- workspace/app-state load;
- save/autosave;
- run/evaluation;
- trace upload and processing;
- export generation;
- billing checkout/portal;
- invite acceptance.

Current active Evaller UI includes busy states. The legacy EvalOps UI includes loading/error handling but is not active on required routes.

## Error States
Error states should:
- show the human-readable message returned by the API;
- preserve correlation IDs where useful for support;
- allow retry where safe;
- not expose secrets or raw sensitive trace content.

E2E currently verifies some transient API recovery behavior in the active Evaller UI.

## Responsive Expectations
- Authenticated app routes should work on mobile, tablet, and desktop.
- Navigation labels and controls must not overlap at 390px width.
- Dense tables should stack or scroll responsibly.
- Primary workflows should remain keyboard and touch usable.

Playwright includes a mobile layout check, but the suite is currently failing overall.

## Accessibility Notes
- Use semantic buttons/links.
- Keep labels attached to inputs.
- Preserve visible focus states.
- Icons in buttons need accessible labels or visible text.
- Alerts and async status messages should be discoverable.
- Color should not be the only signal for risk/status.

## Lovable-Generated UI Cleanup Areas
No explicit Lovable handoff artifact was found, but the code has migration-style residue:
- product names are inconsistent: EvalOps Copilot vs Evaller;
- broad EvalOps UI is present but inactive;
- active page redirects hide intended MVP routes;
- E2E assertions are stale relative to current landing/workspace copy;
- `src/components/workspace-app.tsx` and `src/components/evaller/evaller-app.tsx` are very large and should eventually be decomposed.

## Product Surface Guidance
Until product direction is resolved:
- do not rename everything opportunistically;
- do not delete inactive EvalOps UI;
- do not make public marketing copy claim broader Eval Debt Audit coverage unless the active app supports it;
- keep new UI changes aligned with the roadmap task being executed.
