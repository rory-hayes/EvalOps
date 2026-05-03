create table if not exists public.data_operation_receipts (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text,
  operation text not null check (operation in ('full_project_export', 'project_delete', 'raw_trace_purge', 'export_download')),
  status text not null check (status in ('requested', 'running', 'completed', 'failed')),
  actor_user_id text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  export_id text,
  job_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.data_operation_receipts enable row level security;

create policy "Tenant members can read data_operation_receipts"
on public.data_operation_receipts for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = data_operation_receipts.organization_id
      and membership.user_id = (select auth.uid())::text
  )
);

alter table public.trace_imports
  add column if not exists raw_retention_expires_at timestamptz,
  add column if not exists raw_purged_at timestamptz;

alter table public.uploaded_files
  add column if not exists raw_retention_expires_at timestamptz,
  add column if not exists raw_purged_at timestamptz,
  add column if not exists storage_deleted_at timestamptz;

alter table public.traces
  alter column input drop not null,
  alter column output drop not null,
  alter column metadata drop not null,
  add column if not exists raw_retention_expires_at timestamptz,
  add column if not exists raw_purged_at timestamptz;

alter table public.processing_jobs
  drop constraint if exists processing_jobs_action_check;

alter table public.processing_jobs
  add constraint processing_jobs_action_check
  check (
    action in (
      'trace_import',
      'pii_redaction',
      'intent_generation',
      'eval_generation',
      'grader_generation',
      'baseline_run',
      'prompt_optimization',
      'routing_analysis',
      'report_generation',
      'project_export',
      'project_delete',
      'raw_trace_purge'
    )
  );

alter table public.exports
  drop constraint if exists exports_type_check,
  drop constraint if exists exports_status_check;

alter table public.exports
  add constraint exports_type_check
  check (type in ('eval_pack_csv', 'issues_csv', 'audit_report_csv', 'audit_report_pdf', 'full_project_json')),
  add constraint exports_status_check
  check (status in ('queued', 'running', 'generated', 'failed')),
  add column if not exists checksum text,
  add column if not exists receipt_id text references public.data_operation_receipts(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists completed_at timestamptz,
  add column if not exists expires_at timestamptz;

create index if not exists trace_imports_raw_retention_idx
  on public.trace_imports (organization_id, project_id, raw_retention_expires_at)
  where raw_purged_at is null;

create index if not exists uploaded_files_raw_retention_idx
  on public.uploaded_files (organization_id, project_id, raw_retention_expires_at)
  where raw_purged_at is null;

create index if not exists traces_raw_retention_idx
  on public.traces (organization_id, project_id, raw_retention_expires_at)
  where raw_purged_at is null;

create index if not exists exports_receipt_id_idx
  on public.exports (receipt_id);

create index if not exists data_operation_receipts_org_created_idx
  on public.data_operation_receipts (organization_id, created_at desc);

create index if not exists data_operation_receipts_project_created_idx
  on public.data_operation_receipts (organization_id, project_id, created_at desc);

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
    execute format('drop policy if exists "Tenant members can insert %1$I" on public.%1$I', table_name);
    execute format('drop policy if exists "Tenant members can update %1$I" on public.%1$I', table_name);
  end loop;
end $$;

drop policy if exists "Tenant members can upload own storage objects" on storage.objects;
drop policy if exists "Tenant members can update own storage objects" on storage.objects;
