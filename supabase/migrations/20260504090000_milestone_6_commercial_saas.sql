create table if not exists public.organization_billing (
  organization_id text primary key references public.organizations(id) on delete cascade,
  plan_id text not null default 'starter' check (plan_id in ('starter', 'growth')),
  status text not null default 'setup_required' check (status in ('setup_required', 'trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  stripe_current_period_start timestamptz,
  stripe_current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text references public.projects(id) on delete set null,
  metric text not null check (metric in ('projects', 'uploads', 'exports', 'openai_generations', 'seats')),
  quantity integer not null check (quantity > 0),
  source text not null,
  source_id text,
  period_start timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  livemode boolean not null default false,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.organization_invitations (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member', 'reviewer')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by text not null references public.profiles(id) on delete cascade,
  accepted_by text references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_requests (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id text references public.projects(id) on delete set null,
  actor_user_id text not null references public.profiles(id) on delete cascade,
  request_type text not null check (request_type in ('support', 'incident', 'billing', 'data_request')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'triaged', 'closed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.organization_billing (organization_id)
select id
from public.organizations
on conflict (organization_id) do nothing;

create index if not exists organization_billing_status_idx
  on public.organization_billing (status);

create index if not exists usage_events_organization_period_idx
  on public.usage_events (organization_id, period_start, metric);

create index if not exists usage_events_source_idx
  on public.usage_events (organization_id, source, source_id);

create index if not exists organization_invitations_lookup_idx
  on public.organization_invitations (organization_id, status, email);

create index if not exists organization_invitations_expires_idx
  on public.organization_invitations (expires_at)
  where status = 'pending';

create index if not exists support_requests_org_status_idx
  on public.support_requests (organization_id, status, created_at desc);

alter table public.organization_billing enable row level security;
alter table public.usage_events enable row level security;
alter table public.stripe_events enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.support_requests enable row level security;

create policy "Tenant members can read organization_billing"
on public.organization_billing for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = organization_billing.organization_id
      and membership.user_id = (select auth.uid())::text
  )
);

create policy "Tenant members can read usage_events"
on public.usage_events for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = usage_events.organization_id
      and membership.user_id = (select auth.uid())::text
  )
);

create policy "Tenant members can read organization_invitations"
on public.organization_invitations for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = organization_invitations.organization_id
      and membership.user_id = (select auth.uid())::text
  )
);

create policy "Tenant members can read support_requests"
on public.support_requests for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = support_requests.organization_id
      and membership.user_id = (select auth.uid())::text
  )
);
