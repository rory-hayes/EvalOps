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
      'report_generation'
    )
  );

alter table public.processing_jobs
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.exports
  drop constraint if exists exports_type_check;

alter table public.exports
  add constraint exports_type_check
  check (type in ('eval_pack_csv', 'issues_csv', 'audit_report_csv', 'audit_report_pdf'));

alter table public.eval_cases
  add column if not exists source_job_id text references public.processing_jobs(id) on delete set null,
  add column if not exists source_trace_import_id text references public.trace_imports(id) on delete set null;

alter table public.graders
  add column if not exists source_job_id text references public.processing_jobs(id) on delete set null,
  add column if not exists source_trace_import_id text references public.trace_imports(id) on delete set null;

alter table public.review_issues
  add column if not exists source_job_id text references public.processing_jobs(id) on delete set null,
  add column if not exists source_trace_import_id text references public.trace_imports(id) on delete set null;

alter table public.eval_runs
  add column if not exists source_job_id text references public.processing_jobs(id) on delete set null,
  add column if not exists source_trace_import_id text references public.trace_imports(id) on delete set null;

alter table public.failure_clusters
  add column if not exists source_job_id text references public.processing_jobs(id) on delete set null,
  add column if not exists source_trace_import_id text references public.trace_imports(id) on delete set null;

alter table public.prompt_candidates
  add column if not exists source_job_id text references public.processing_jobs(id) on delete set null,
  add column if not exists source_trace_import_id text references public.trace_imports(id) on delete set null;

alter table public.routing_rules
  add column if not exists source_job_id text references public.processing_jobs(id) on delete set null,
  add column if not exists source_trace_import_id text references public.trace_imports(id) on delete set null;

alter table public.cache_recommendations
  add column if not exists source_job_id text references public.processing_jobs(id) on delete set null,
  add column if not exists source_trace_import_id text references public.trace_imports(id) on delete set null;

alter table public.reports
  add column if not exists source_job_id text references public.processing_jobs(id) on delete set null,
  add column if not exists source_trace_import_id text references public.trace_imports(id) on delete set null;

create index if not exists processing_jobs_project_status_idx
  on public.processing_jobs (organization_id, project_id, status, created_at desc);

create index if not exists eval_cases_source_trace_import_idx
  on public.eval_cases (organization_id, project_id, source_trace_import_id);

create unique index if not exists uploaded_files_project_checksum_uidx
  on public.uploaded_files (organization_id, project_id, checksum);
