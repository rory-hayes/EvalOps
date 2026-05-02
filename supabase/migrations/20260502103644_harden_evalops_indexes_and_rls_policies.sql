-- Cover foreign keys that are used by joins, deletes, and tenant-scoped lookups.
create index if not exists organization_memberships_user_id_idx on public.organization_memberships (user_id);

create index if not exists trace_imports_project_id_idx on public.trace_imports (project_id);

create index if not exists uploaded_files_organization_id_idx on public.uploaded_files (organization_id);
create index if not exists uploaded_files_project_id_idx on public.uploaded_files (project_id);
create index if not exists uploaded_files_trace_import_id_idx on public.uploaded_files (trace_import_id);

create index if not exists processing_jobs_organization_id_idx on public.processing_jobs (organization_id);
create index if not exists processing_jobs_project_id_idx on public.processing_jobs (project_id);
create index if not exists processing_jobs_trace_import_id_idx on public.processing_jobs (trace_import_id);

create index if not exists traces_project_id_idx on public.traces (project_id);
create index if not exists traces_trace_import_id_idx on public.traces (trace_import_id);

create index if not exists eval_cases_project_id_idx on public.eval_cases (project_id);
create index if not exists eval_cases_trace_id_idx on public.eval_cases (trace_id);

create index if not exists graders_organization_id_idx on public.graders (organization_id);
create index if not exists graders_project_id_idx on public.graders (project_id);

create index if not exists review_issues_project_id_idx on public.review_issues (project_id);
create index if not exists review_issues_eval_case_id_idx on public.review_issues (eval_case_id);
create index if not exists review_issues_trace_id_idx on public.review_issues (trace_id);
create index if not exists review_issues_resolved_by_idx on public.review_issues (resolved_by);

create index if not exists issue_comments_organization_id_idx on public.issue_comments (organization_id);
create index if not exists issue_comments_project_id_idx on public.issue_comments (project_id);
create index if not exists issue_comments_issue_id_idx on public.issue_comments (issue_id);
create index if not exists issue_comments_actor_user_id_idx on public.issue_comments (actor_user_id);

create index if not exists eval_runs_organization_id_idx on public.eval_runs (organization_id);
create index if not exists eval_runs_project_id_idx on public.eval_runs (project_id);

create index if not exists failure_clusters_organization_id_idx on public.failure_clusters (organization_id);
create index if not exists failure_clusters_project_id_idx on public.failure_clusters (project_id);

create index if not exists prompt_versions_organization_id_idx on public.prompt_versions (organization_id);
create index if not exists prompt_versions_project_id_idx on public.prompt_versions (project_id);

create index if not exists prompt_candidates_organization_id_idx on public.prompt_candidates (organization_id);
create index if not exists prompt_candidates_project_id_idx on public.prompt_candidates (project_id);

create index if not exists routing_rules_organization_id_idx on public.routing_rules (organization_id);
create index if not exists routing_rules_project_id_idx on public.routing_rules (project_id);

create index if not exists cache_recommendations_organization_id_idx on public.cache_recommendations (organization_id);
create index if not exists cache_recommendations_project_id_idx on public.cache_recommendations (project_id);

create index if not exists reports_organization_id_idx on public.reports (organization_id);
create index if not exists reports_project_id_idx on public.reports (project_id);

create index if not exists exports_organization_id_idx on public.exports (organization_id);
create index if not exists exports_project_id_idx on public.exports (project_id);

-- Keep auth.jwt() in an initplan so tenant policies do not re-evaluate per row.
alter policy "Members can read their organization"
on public.organizations
using (id = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')));

alter policy "Members can read own membership"
on public.organization_memberships
using (
  organization_id = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id'))
  and user_id = (select auth.jwt()->>'sub')
);

alter policy "Tenant members can read projects"
on public.projects
using (organization_id = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')));

alter policy "Tenant admins can insert projects"
on public.projects
with check (organization_id = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')));

alter policy "Tenant admins can update projects"
on public.projects
using (organization_id = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')))
with check (organization_id = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')));

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
      'alter policy "Tenant members can read %1$I" on public.%1$I using (organization_id = (select coalesce(auth.jwt()->>''org_id'', auth.jwt()->''o''->>''id'')))',
      table_name
    );
    execute format(
      'alter policy "Tenant members can insert %1$I" on public.%1$I with check (organization_id = (select coalesce(auth.jwt()->>''org_id'', auth.jwt()->''o''->>''id'')))',
      table_name
    );
    execute format(
      'alter policy "Tenant members can update %1$I" on public.%1$I using (organization_id = (select coalesce(auth.jwt()->>''org_id'', auth.jwt()->''o''->>''id''))) with check (organization_id = (select coalesce(auth.jwt()->>''org_id'', auth.jwt()->''o''->>''id'')))',
      table_name
    );
  end loop;
end $$;

alter policy "Tenant members can read own storage objects"
on storage.objects
using (
  bucket_id in ('evalops-trace-uploads', 'evalops-exports')
  and (storage.foldername(name))[1] = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id'))
);

alter policy "Tenant members can upload own storage objects"
on storage.objects
with check (
  bucket_id in ('evalops-trace-uploads', 'evalops-exports')
  and (storage.foldername(name))[1] = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id'))
);

alter policy "Tenant members can update own storage objects"
on storage.objects
using (
  bucket_id in ('evalops-trace-uploads', 'evalops-exports')
  and (storage.foldername(name))[1] = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id'))
)
with check (
  bucket_id in ('evalops-trace-uploads', 'evalops-exports')
  and (storage.foldername(name))[1] = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id'))
);
