create table if not exists public.ai_tests (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  owner_user_id text not null references public.profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  quality_bar integer not null default 80 check (quality_bar >= 50 and quality_bar <= 100),
  active_prompt_version_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_test_prompt_versions (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  ai_test_id text not null references public.ai_tests(id) on delete cascade,
  version integer not null check (version >= 1),
  label text not null,
  instructions text not null,
  is_active boolean not null default false,
  source_suggestion_id text,
  created_at timestamptz not null default now(),
  unique (ai_test_id, version)
);

alter table public.ai_tests
  add constraint ai_tests_active_prompt_version_id_fkey
  foreign key (active_prompt_version_id)
  references public.ai_test_prompt_versions(id)
  on delete set null
  deferrable initially deferred;

create table if not exists public.ai_test_scenarios (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  ai_test_id text not null references public.ai_tests(id) on delete cascade,
  title text not null,
  message text not null,
  expected_behavior text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_test_success_criteria (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  ai_test_id text not null references public.ai_tests(id) on delete cascade,
  text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_test_runs (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  ai_test_id text not null references public.ai_tests(id) on delete cascade,
  prompt_version_id text not null references public.ai_test_prompt_versions(id) on delete restrict,
  prompt_version_label text not null,
  status text not null check (status in ('running', 'completed', 'failed')),
  quality_bar integer not null check (quality_bar >= 50 and quality_bar <= 100),
  pass_rate numeric not null default 0,
  average_score numeric not null default 0,
  total_scenarios integer not null default 0,
  failed_scenarios integer not null default 0,
  previous_run_id text references public.ai_test_runs(id) on delete set null,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ai_test_scenario_results (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  ai_test_id text not null references public.ai_tests(id) on delete cascade,
  run_id text not null references public.ai_test_runs(id) on delete cascade,
  scenario_id text references public.ai_test_scenarios(id) on delete set null,
  scenario_title text not null,
  scenario_message text not null,
  assistant_response text not null,
  score integer not null check (score >= 0 and score <= 100),
  status text not null check (status in ('passed', 'failed')),
  passed_criteria text[] not null default '{}',
  failed_criteria text[] not null default '{}',
  rationale text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_test_failure_patterns (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  ai_test_id text not null references public.ai_tests(id) on delete cascade,
  run_id text not null references public.ai_test_runs(id) on delete cascade,
  title text not null,
  description text not null,
  failed_criteria text[] not null default '{}',
  scenario_ids text[] not null default '{}',
  severity text not null check (severity in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_test_prompt_suggestions (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  ai_test_id text not null references public.ai_tests(id) on delete cascade,
  run_id text not null references public.ai_test_runs(id) on delete cascade,
  title text not null,
  explanation text not null,
  patch text not null,
  revised_instructions text not null,
  affected_criteria text[] not null default '{}',
  applied_at timestamptz,
  applied_prompt_version_id text references public.ai_test_prompt_versions(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.ai_test_prompt_versions
  add constraint ai_test_prompt_versions_source_suggestion_id_fkey
  foreign key (source_suggestion_id)
  references public.ai_test_prompt_suggestions(id)
  on delete set null
  deferrable initially deferred;

create index if not exists ai_tests_org_idx on public.ai_tests (organization_id, created_at);
create index if not exists ai_test_runs_test_idx on public.ai_test_runs (organization_id, ai_test_id, started_at desc);
create index if not exists ai_test_results_run_idx on public.ai_test_scenario_results (organization_id, run_id);
create index if not exists ai_test_patterns_run_idx on public.ai_test_failure_patterns (organization_id, run_id);
create index if not exists ai_test_suggestions_run_idx on public.ai_test_prompt_suggestions (organization_id, run_id);

alter table public.ai_tests enable row level security;
alter table public.ai_test_prompt_versions enable row level security;
alter table public.ai_test_scenarios enable row level security;
alter table public.ai_test_success_criteria enable row level security;
alter table public.ai_test_runs enable row level security;
alter table public.ai_test_scenario_results enable row level security;
alter table public.ai_test_failure_patterns enable row level security;
alter table public.ai_test_prompt_suggestions enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'ai_tests',
    'ai_test_prompt_versions',
    'ai_test_scenarios',
    'ai_test_success_criteria',
    'ai_test_runs',
    'ai_test_scenario_results',
    'ai_test_failure_patterns',
    'ai_test_prompt_suggestions'
  ]
  loop
    execute format(
      'create policy "Tenant members can manage %1$I" on public.%1$I for all to authenticated using (exists (select 1 from public.organization_memberships membership where membership.organization_id = %1$I.organization_id and membership.user_id = (select auth.uid())::text)) with check (exists (select 1 from public.organization_memberships membership where membership.organization_id = %1$I.organization_id and membership.user_id = (select auth.uid())::text))',
      table_name
    );
  end loop;
end $$;
