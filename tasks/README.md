# Task Workflow

This repository is now organized for controlled, ticket-driven Codex work.

## Rules
- One Linear issue equals one branch and one pull request.
- Every issue goes through a plan-only Codex pass before implementation.
- Do not bundle unrelated issues into one PR.
- Do not mark a Linear issue Done unless validation commands have passed or the issue is explicitly docs-only and reviewed.
- Update `ROADMAP.md` and Linear after meaningful work or newly discovered gaps.

## Branch Names
Use the branch name from the issue, for example:

```bash
codex/evl-prod-001-product-decision
```

## Plan Files
Save approved plan-only work under:

```text
tasks/plans/<TASK-ID>-plan.md
```

Example:

```text
tasks/plans/EVL-PROD-001-plan.md
```

## Implementation Summaries
After implementation, save a concise summary under:

```text
tasks/summaries/<TASK-ID>-summary.md
```

The summary should include files changed, validation commands/results, remaining risks, and any follow-up issues created.

## Linear And Roadmap Updates
- Keep Linear as the execution tracker.
- Keep `linear-export/issues.json` as an audit/export trail.
- Update `ROADMAP.md` when a task is completed, split, blocked, or when new gaps are discovered.
- Keep `command-centre/` exports refreshed when project status changes.
