create extension if not exists pgcrypto;

create table public.profiles (
  id text primary key,
  email text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'reviewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.projects (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  workflow_type text not null check (workflow_type in ('support_assistant', 'rag', 'tool_agent', 'document_extraction', 'custom')),
  objective text not null,
  risk_preferences text[] not null default '{}',
  privacy_mode text not null check (privacy_mode in ('redact_pii', 'derived_only', 'short_retention')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trace_imports (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  source text not null check (source in ('CSV', 'JSON', 'NDJSON', 'TXT')),
  name text not null,
  imported_at timestamptz not null default now(),
  traces integer not null default 0 check (traces >= 0),
  rows integer not null default 0 check (rows >= 0),
  status text not null check (status in ('processing', 'completed', 'failed')),
  redaction_status text not null check (redaction_status in ('in_progress', 'redacted', 'pending', 'failed')),
  primary_intent text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high'))
);

create table public.uploaded_files (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  trace_import_id text not null references public.trace_imports(id) on delete cascade,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  storage_bucket text not null,
  storage_path text not null,
  checksum text not null,
  created_at timestamptz not null default now()
);

create table public.processing_jobs (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  trace_import_id text references public.trace_imports(id) on delete set null,
  action text not null check (action in ('trace_import')),
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.traces (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  trace_import_id text not null references public.trace_imports(id) on delete cascade,
  external_id text not null,
  source_type text not null check (source_type in ('CSV', 'JSON', 'NDJSON', 'TXT')),
  input text not null,
  output text not null,
  redacted_input text not null,
  redacted_output text not null,
  redaction_hits text[] not null default '{}',
  intent text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.eval_cases (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  trace_id text references public.traces(id) on delete set null,
  name text not null,
  eval_set text not null check (eval_set in ('golden', 'regression', 'edge', 'safety')),
  intent text not null,
  source text not null check (source in ('production', 'synthetic', 'requirements', 'known_failure')),
  risk text not null check (risk in ('low', 'medium', 'high')),
  grader text not null,
  last_result numeric not null check (last_result >= 0 and last_result <= 100),
  status text not null check (status in ('passed', 'failed', 'review')),
  user_input text not null,
  expected_behavior text not null,
  acceptance_criteria text[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.graders (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  name text not null,
  type text not null check (type in ('deterministic', 'llm_judge')),
  description text not null,
  health text not null check (health in ('healthy', 'low_agreement', 'review')),
  agreement numeric not null check (agreement >= 0 and agreement <= 1),
  model text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.review_issues (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  eval_case_id text not null references public.eval_cases(id) on delete cascade,
  trace_id text references public.traces(id) on delete set null,
  title text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  status text not null check (status in ('open', 'resolved', 'ignored', 'reopened')),
  description text not null,
  resolved_by text references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.issue_comments (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  issue_id text not null references public.review_issues(id) on delete cascade,
  actor_user_id text not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.eval_runs (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  pass_rate numeric not null default 0,
  total_cases integer not null default 0,
  failed_cases integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.failure_clusters (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  label text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  issue_count integer not null default 0,
  percent numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.prompt_versions (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  label text not null,
  prompt text not null,
  status text not null check (status in ('current', 'candidate', 'promoted')),
  created_at timestamptz not null default now()
);

create table public.prompt_candidates (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  expected_quality_lift numeric not null default 0,
  expected_cost_delta numeric not null default 0,
  regression_risk text not null check (regression_risk in ('low', 'medium', 'high')),
  explanation text not null,
  created_at timestamptz not null default now()
);

create table public.routing_rules (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  intent text not null,
  model text not null,
  fallback text not null,
  quality_score numeric not null default 0,
  estimated_cost numeric not null default 0,
  estimated_latency_ms integer not null default 0,
  traffic_share numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.cache_recommendations (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  detail text not null,
  impact text not null check (impact in ('low', 'medium', 'high')),
  estimated_monthly_savings numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.reports (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  summary text not null,
  readiness_score numeric not null default 0,
  recommendations text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.exports (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  type text not null check (type in ('eval_pack_csv', 'issues_csv', 'audit_report_csv')),
  status text not null check (status in ('generated', 'failed')),
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  actor_user_id text not null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  status text not null check (status in ('started', 'succeeded', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  correlation_id text,
  created_at timestamptz not null default now()
);

create index on public.organization_memberships (organization_id, user_id);
create index on public.projects (organization_id);
create index on public.trace_imports (organization_id, project_id, imported_at desc);
create index on public.traces (organization_id, project_id, trace_import_id);
create index on public.eval_cases (organization_id, project_id, status, risk);
create index on public.review_issues (organization_id, project_id, status, severity);
create index on public.audit_events (organization_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.projects enable row level security;
alter table public.trace_imports enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.traces enable row level security;
alter table public.eval_cases enable row level security;
alter table public.graders enable row level security;
alter table public.review_issues enable row level security;
alter table public.issue_comments enable row level security;
alter table public.eval_runs enable row level security;
alter table public.failure_clusters enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.prompt_candidates enable row level security;
alter table public.routing_rules enable row level security;
alter table public.cache_recommendations enable row level security;
alter table public.reports enable row level security;
alter table public.exports enable row level security;
alter table public.audit_events enable row level security;

create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = (select auth.jwt()->>'sub'));

create policy "Users can maintain own profile"
on public.profiles for insert
to authenticated
with check (id = (select auth.jwt()->>'sub'));

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (id = (select auth.jwt()->>'sub'))
with check (id = (select auth.jwt()->>'sub'));

create policy "Members can read their organization"
on public.organizations for select
to authenticated
using (
  id = coalesce((select auth.jwt()->>'org_id'), (select auth.jwt()->'o'->>'id'))
);

create policy "Members can read own membership"
on public.organization_memberships for select
to authenticated
using (
  organization_id = coalesce((select auth.jwt()->>'org_id'), (select auth.jwt()->'o'->>'id'))
  and user_id = (select auth.jwt()->>'sub')
);

create policy "Tenant members can read projects"
on public.projects for select
to authenticated
using (
  organization_id = coalesce((select auth.jwt()->>'org_id'), (select auth.jwt()->'o'->>'id'))
);

create policy "Tenant admins can insert projects"
on public.projects for insert
to authenticated
with check (
  organization_id = coalesce((select auth.jwt()->>'org_id'), (select auth.jwt()->'o'->>'id'))
);

create policy "Tenant admins can update projects"
on public.projects for update
to authenticated
using (
  organization_id = coalesce((select auth.jwt()->>'org_id'), (select auth.jwt()->'o'->>'id'))
)
with check (
  organization_id = coalesce((select auth.jwt()->>'org_id'), (select auth.jwt()->'o'->>'id'))
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'trace_imports',
    'uploaded_files',
    'processing_jobs',
    'traces',
    'eval_cases',
    'graders',
    'review_issues',
    'issue_comments',
    'eval_runs',
    'failure_clusters',
    'prompt_versions',
    'prompt_candidates',
    'routing_rules',
    'cache_recommendations',
    'reports',
    'exports',
    'audit_events'
  ]
  loop
    execute format(
      'create policy "Tenant members can read %1$I" on public.%1$I for select to authenticated using (organization_id = coalesce((select auth.jwt()->>''org_id''), (select auth.jwt()->''o''->>''id'')))',
      table_name
    );
    execute format(
      'create policy "Tenant members can insert %1$I" on public.%1$I for insert to authenticated with check (organization_id = coalesce((select auth.jwt()->>''org_id''), (select auth.jwt()->''o''->>''id'')))',
      table_name
    );
    execute format(
      'create policy "Tenant members can update %1$I" on public.%1$I for update to authenticated using (organization_id = coalesce((select auth.jwt()->>''org_id''), (select auth.jwt()->''o''->>''id''))) with check (organization_id = coalesce((select auth.jwt()->>''org_id''), (select auth.jwt()->''o''->>''id'')))',
      table_name
    );
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('evalops-trace-uploads', 'evalops-trace-uploads', false, 52428800, array[
    'text/csv',
    'text/plain',
    'application/json',
    'application/x-ndjson',
    'application/zip',
    'application/pdf'
  ]),
  ('evalops-exports', 'evalops-exports', false, 52428800, array[
    'text/csv',
    'application/json',
    'application/pdf',
    'application/yaml',
    'text/yaml'
  ])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Tenant members can read own storage objects"
on storage.objects for select
to authenticated
using (
  bucket_id in ('evalops-trace-uploads', 'evalops-exports')
  and (storage.foldername(name))[1] = coalesce((select auth.jwt()->>'org_id'), (select auth.jwt()->'o'->>'id'))
);

create policy "Tenant members can upload own storage objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('evalops-trace-uploads', 'evalops-exports')
  and (storage.foldername(name))[1] = coalesce((select auth.jwt()->>'org_id'), (select auth.jwt()->'o'->>'id'))
);

create policy "Tenant members can update own storage objects"
on storage.objects for update
to authenticated
using (
  bucket_id in ('evalops-trace-uploads', 'evalops-exports')
  and (storage.foldername(name))[1] = coalesce((select auth.jwt()->>'org_id'), (select auth.jwt()->'o'->>'id'))
)
with check (
  bucket_id in ('evalops-trace-uploads', 'evalops-exports')
  and (storage.foldername(name))[1] = coalesce((select auth.jwt()->>'org_id'), (select auth.jwt()->'o'->>'id'))
);
