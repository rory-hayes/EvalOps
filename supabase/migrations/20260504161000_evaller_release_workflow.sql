create table if not exists public.ai_test_readiness_reports (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  ai_test_id text not null references public.ai_tests(id) on delete cascade,
  run_id text not null references public.ai_test_runs(id) on delete cascade,
  status text not null check (status in ('Ready for release review', 'Improved, needs follow-up', 'Not ready')),
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'changes_requested')),
  summary text not null,
  before_pass_rate numeric,
  after_pass_rate numeric not null,
  applied_prompt_change text not null,
  remaining_risks text[] not null default '{}',
  recommended_next_step text not null,
  copy_text text not null,
  approved_by text references public.profiles(id) on delete set null,
  approved_at timestamptz,
  approval_note text,
  copy_count integer not null default 0 check (copy_count >= 0),
  last_copied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id)
);

create table if not exists public.ai_test_review_comments (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  ai_test_id text not null references public.ai_tests(id) on delete cascade,
  run_id text not null references public.ai_test_runs(id) on delete cascade,
  report_id text references public.ai_test_readiness_reports(id) on delete set null,
  actor_user_id text not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_test_readiness_reports_run_idx
  on public.ai_test_readiness_reports (organization_id, run_id);

create index if not exists ai_test_review_comments_run_idx
  on public.ai_test_review_comments (organization_id, run_id, created_at desc);

alter table public.ai_test_readiness_reports enable row level security;
alter table public.ai_test_review_comments enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'ai_test_readiness_reports',
    'ai_test_review_comments'
  ]
  loop
    execute format(
      'create policy "Tenant members can manage %1$I" on public.%1$I for all to authenticated using (exists (select 1 from public.organization_memberships membership where membership.organization_id = %1$I.organization_id and membership.user_id = (select auth.uid())::text)) with check (exists (select 1 from public.organization_memberships membership where membership.organization_id = %1$I.organization_id and membership.user_id = (select auth.uid())::text))',
      table_name
    );
  end loop;
end $$;
