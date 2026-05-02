alter policy "Users can read own profile"
on public.profiles
using (id = (select auth.jwt())->>'sub');

alter policy "Users can maintain own profile"
on public.profiles
with check (id = (select auth.jwt())->>'sub');

alter policy "Users can update own profile"
on public.profiles
using (id = (select auth.jwt())->>'sub')
with check (id = (select auth.jwt())->>'sub');

alter policy "Members can read their organization"
on public.organizations
using (id = coalesce((select auth.jwt())->>'org_id', (select auth.jwt())->'o'->>'id'));

alter policy "Members can read own membership"
on public.organization_memberships
using (
  organization_id = coalesce((select auth.jwt())->>'org_id', (select auth.jwt())->'o'->>'id')
  and user_id = (select auth.jwt())->>'sub'
);

alter policy "Tenant members can read projects"
on public.projects
using (organization_id = coalesce((select auth.jwt())->>'org_id', (select auth.jwt())->'o'->>'id'));

alter policy "Tenant admins can insert projects"
on public.projects
with check (organization_id = coalesce((select auth.jwt())->>'org_id', (select auth.jwt())->'o'->>'id'));

alter policy "Tenant admins can update projects"
on public.projects
using (organization_id = coalesce((select auth.jwt())->>'org_id', (select auth.jwt())->'o'->>'id'))
with check (organization_id = coalesce((select auth.jwt())->>'org_id', (select auth.jwt())->'o'->>'id'));

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
      'alter policy "Tenant members can read %1$I" on public.%1$I using (organization_id = coalesce((select auth.jwt())->>''org_id'', (select auth.jwt())->''o''->>''id''))',
      table_name
    );
    execute format(
      'alter policy "Tenant members can insert %1$I" on public.%1$I with check (organization_id = coalesce((select auth.jwt())->>''org_id'', (select auth.jwt())->''o''->>''id''))',
      table_name
    );
    execute format(
      'alter policy "Tenant members can update %1$I" on public.%1$I using (organization_id = coalesce((select auth.jwt())->>''org_id'', (select auth.jwt())->''o''->>''id'')) with check (organization_id = coalesce((select auth.jwt())->>''org_id'', (select auth.jwt())->''o''->>''id''))',
      table_name
    );
  end loop;
end $$;

alter policy "Tenant members can read own storage objects"
on storage.objects
using (
  bucket_id in ('evalops-trace-uploads', 'evalops-exports')
  and (storage.foldername(name))[1] = coalesce((select auth.jwt())->>'org_id', (select auth.jwt())->'o'->>'id')
);

alter policy "Tenant members can upload own storage objects"
on storage.objects
with check (
  bucket_id in ('evalops-trace-uploads', 'evalops-exports')
  and (storage.foldername(name))[1] = coalesce((select auth.jwt())->>'org_id', (select auth.jwt())->'o'->>'id')
);

alter policy "Tenant members can update own storage objects"
on storage.objects
using (
  bucket_id in ('evalops-trace-uploads', 'evalops-exports')
  and (storage.foldername(name))[1] = coalesce((select auth.jwt())->>'org_id', (select auth.jwt())->'o'->>'id')
)
with check (
  bucket_id in ('evalops-trace-uploads', 'evalops-exports')
  and (storage.foldername(name))[1] = coalesce((select auth.jwt())->>'org_id', (select auth.jwt())->'o'->>'id')
);
