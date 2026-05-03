alter table public.graders
  add column if not exists pass_threshold numeric not null default 0.8 check (pass_threshold >= 0 and pass_threshold <= 1),
  add column if not exists review_threshold numeric not null default 0.6 check (review_threshold >= 0 and review_threshold <= 1),
  add column if not exists rubric text not null default '',
  add column if not exists failure_modes text[] not null default '{}',
  add column if not exists last_calibrated_at timestamptz;

alter table public.eval_runs
  add column if not exists run_type text not null default 'manual'
    check (run_type in ('baseline', 'manual', 'candidate_comparison', 'calibration')),
  add column if not exists prompt_version_id text references public.prompt_versions(id) on delete set null,
  add column if not exists prompt_candidate_id text references public.prompt_candidates(id) on delete set null,
  add column if not exists average_score numeric,
  add column if not exists review_cases integer not null default 0,
  add column if not exists total_results integer not null default 0,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.prompt_candidates
  add column if not exists prompt_body text not null default '',
  add column if not exists source_prompt_version_id text references public.prompt_versions(id) on delete set null,
  add column if not exists diff_summary text,
  add column if not exists expected_latency_delta_ms integer,
  add column if not exists baseline_pass_rate numeric,
  add column if not exists candidate_pass_rate numeric,
  add column if not exists confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  add column if not exists evidence_refs jsonb not null default '[]'::jsonb;

alter table public.routing_rules
  add column if not exists confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  add column if not exists evidence_refs jsonb not null default '[]'::jsonb,
  add column if not exists calculation_basis text;

alter table public.cache_recommendations
  add column if not exists confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  add column if not exists evidence_refs jsonb not null default '[]'::jsonb,
  add column if not exists calculation_basis text;

alter table public.reports
  add column if not exists evidence_refs jsonb not null default '[]'::jsonb,
  add column if not exists confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  add column if not exists structured_sections jsonb not null default '[]'::jsonb;

create table if not exists public.eval_results (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  eval_run_id text not null references public.eval_runs(id) on delete cascade,
  eval_case_id text not null references public.eval_cases(id) on delete cascade,
  grader_id text not null references public.graders(id) on delete cascade,
  status text not null check (status in ('passed', 'failed', 'review')),
  score numeric not null check (score >= 0 and score <= 100),
  rationale text not null,
  evidence_refs jsonb not null default '[]'::jsonb,
  prompt_version_id text references public.prompt_versions(id) on delete set null,
  prompt_candidate_id text references public.prompt_candidates(id) on delete set null,
  model text,
  latency_ms integer,
  estimated_cost numeric,
  token_usage jsonb,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now(),
  unique (eval_run_id, eval_case_id, grader_id)
);

create table if not exists public.human_labels (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  eval_case_id text not null references public.eval_cases(id) on delete cascade,
  grader_id text not null references public.graders(id) on delete cascade,
  score numeric not null check (score >= 0 and score <= 100),
  status text not null check (status in ('passed', 'failed', 'review')),
  notes text,
  labeled_by text not null references public.profiles(id) on delete cascade,
  labeled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, project_id, eval_case_id, grader_id)
);

create table if not exists public.grader_calibration_runs (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  grader_id text not null references public.graders(id) on delete cascade,
  status text not null check (status in ('completed', 'review')),
  agreement numeric not null check (agreement >= 0 and agreement <= 1),
  total_labels integer not null default 0,
  disagreement_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.grader_calibration_results (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  calibration_run_id text not null references public.grader_calibration_runs(id) on delete cascade,
  eval_case_id text not null references public.eval_cases(id) on delete cascade,
  grader_id text not null references public.graders(id) on delete cascade,
  human_label_id text not null references public.human_labels(id) on delete cascade,
  eval_result_id text references public.eval_results(id) on delete set null,
  human_score numeric not null check (human_score >= 0 and human_score <= 100),
  judge_score numeric check (judge_score is null or (judge_score >= 0 and judge_score <= 100)),
  score_delta numeric not null check (score_delta >= 0 and score_delta <= 100),
  disagreement_severity text not null check (disagreement_severity in ('none', 'low', 'medium', 'high')),
  review_status text not null check (review_status in ('open', 'accepted', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists eval_results_project_run_idx
  on public.eval_results (organization_id, project_id, eval_run_id);

create index if not exists eval_results_case_grader_idx
  on public.eval_results (organization_id, project_id, eval_case_id, grader_id, created_at desc);

create index if not exists human_labels_project_case_idx
  on public.human_labels (organization_id, project_id, eval_case_id, grader_id);

create index if not exists grader_calibration_runs_project_idx
  on public.grader_calibration_runs (organization_id, project_id, grader_id, created_at desc);

create index if not exists grader_calibration_results_project_idx
  on public.grader_calibration_results (organization_id, project_id, grader_id, created_at desc);

alter table public.eval_results enable row level security;
alter table public.human_labels enable row level security;
alter table public.grader_calibration_runs enable row level security;
alter table public.grader_calibration_results enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'eval_results',
    'human_labels',
    'grader_calibration_runs',
    'grader_calibration_results'
  ]
  loop
    execute format(
      'create policy "Tenant members can read %1$I" on public.%1$I for select to authenticated using (exists (select 1 from public.organization_memberships membership where membership.organization_id = %1$I.organization_id and membership.user_id = (select auth.uid())::text))',
      table_name
    );
  end loop;
end $$;
