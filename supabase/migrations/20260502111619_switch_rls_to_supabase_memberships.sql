-- Supabase Auth is now the source of truth for user identity.
-- Tenant policies use auth.uid() plus durable organization memberships instead
-- of external organization claims in auth.jwt().

alter policy "Users can read own profile"
on public.profiles
using (id = (select auth.uid())::text);

alter policy "Users can maintain own profile"
on public.profiles
with check (id = (select auth.uid())::text);

alter policy "Users can update own profile"
on public.profiles
using (id = (select auth.uid())::text)
with check (id = (select auth.uid())::text);

alter policy "Members can read own membership"
on public.organization_memberships
using (user_id = (select auth.uid())::text);

alter policy "Members can read their organization"
on public.organizations
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = organizations.id
      and membership.user_id = (select auth.uid())::text
  )
);

alter policy "Tenant members can read projects"
on public.projects
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = projects.organization_id
      and membership.user_id = (select auth.uid())::text
  )
);

alter policy "Tenant admins can insert projects"
on public.projects
with check (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = projects.organization_id
      and membership.user_id = (select auth.uid())::text
      and membership.role in ('owner', 'admin')
  )
);

alter policy "Tenant admins can update projects"
on public.projects
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = projects.organization_id
      and membership.user_id = (select auth.uid())::text
      and membership.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = projects.organization_id
      and membership.user_id = (select auth.uid())::text
      and membership.role in ('owner', 'admin')
  )
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
      'alter policy "Tenant members can read %1$I" on public.%1$I using (exists (select 1 from public.organization_memberships membership where membership.organization_id = %1$I.organization_id and membership.user_id = (select auth.uid())::text))',
      table_name
    );
    execute format(
      'alter policy "Tenant members can insert %1$I" on public.%1$I with check (exists (select 1 from public.organization_memberships membership where membership.organization_id = %1$I.organization_id and membership.user_id = (select auth.uid())::text))',
      table_name
    );
    execute format(
      'alter policy "Tenant members can update %1$I" on public.%1$I using (exists (select 1 from public.organization_memberships membership where membership.organization_id = %1$I.organization_id and membership.user_id = (select auth.uid())::text)) with check (exists (select 1 from public.organization_memberships membership where membership.organization_id = %1$I.organization_id and membership.user_id = (select auth.uid())::text))',
      table_name
    );
  end loop;
end $$;

alter policy "Tenant members can read own storage objects"
on storage.objects
using (
  bucket_id in ('evalops-trace-uploads', 'evalops-exports')
  and exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = (storage.foldername(name))[1]
      and membership.user_id = (select auth.uid())::text
  )
);

alter policy "Tenant members can upload own storage objects"
on storage.objects
with check (
  bucket_id in ('evalops-trace-uploads', 'evalops-exports')
  and exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = (storage.foldername(name))[1]
      and membership.user_id = (select auth.uid())::text
  )
);

alter policy "Tenant members can update own storage objects"
on storage.objects
using (
  bucket_id in ('evalops-trace-uploads', 'evalops-exports')
  and exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = (storage.foldername(name))[1]
      and membership.user_id = (select auth.uid())::text
  )
)
with check (
  bucket_id in ('evalops-trace-uploads', 'evalops-exports')
  and exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = (storage.foldername(name))[1]
      and membership.user_id = (select auth.uid())::text
  )
);
