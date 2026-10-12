-- Plannr v1 schema.
--
-- Multi-tenant model: every row of customer data carries a firm_id, and
-- Row Level Security restricts every table to the firm of the logged-in user.
-- Child tables use composite foreign keys (parent_id, firm_id) so a row can
-- never point at a parent that belongs to another firm.
--
-- Run this file once against a fresh Supabase project (SQL Editor or
-- `npx supabase db push`). See README.md for step-by-step instructions.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('owner', 'planner');
create type public.plan_status as enum ('concept', 'in_bewerking', 'afgerond');
create type public.asset_side as enum ('prive', 'zakelijk');
create type public.value_source as enum ('handmatig', 'document');
create type public.document_type as enum ('ib_aangifte', 'jaarrekening');
create type public.extraction_status as enum ('in_behandeling', 'verwerkt', 'mislukt');
create type public.layout_variant as enum ('klassiek', 'modern', 'minimalistisch');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  website_url text,
  created_at timestamptz not null default now()
);

-- App-level profile for every person working inside a firm.
-- (auth.users holds credentials; this table holds firm membership and role.)
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  firm_id uuid not null references public.firms (id) on delete cascade,
  name text not null default '',
  email text not null,
  role public.user_role not null default 'planner',
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
create index users_firm_id_idx on public.users (firm_id);

-- Plannr staff. Rows are only ever added by hand (SQL editor / seed script);
-- there is no API path that writes to this table.
create table public.super_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email like '%@%'),
  invited_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (firm_id, email)
);

create table public.house_styles (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  -- Path inside the private "logos" storage bucket (signed URLs are generated on read).
  logo_path text,
  primary_color text not null default '#1F3A5F' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#4A6FA5' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#C9A227' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  font_heading text not null default 'Merriweather',
  font_body text not null default 'Inter',
  layout_variant public.layout_variant not null default 'klassiek',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index house_styles_one_active_per_firm on public.house_styles (firm_id) where is_active;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  last_name text not null check (length(trim(last_name)) between 1 and 100),
  company_name text check (company_name is null or length(company_name) <= 200),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, firm_id)
);
create index clients_firm_updated_idx on public.clients (firm_id, updated_at desc);

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  client_id uuid not null,
  author_id uuid references public.users (id) on delete set null,
  content text not null check (length(trim(content)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, firm_id) references public.clients (id, firm_id) on delete cascade
);
create index client_notes_client_idx on public.client_notes (client_id, created_at desc);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  client_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 200),
  status public.plan_status not null default 'concept',
  current_step text not null default 'configuratie',
  -- Which sections the plan covers + report sections (typed as PlanConfig in TS).
  config jsonb not null default '{}'::jsonb,
  -- Non-asset fields for the privé and zakelijk steps (typed as PlanInputs in TS).
  inputs jsonb not null default '{}'::jsonb,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, firm_id),
  foreign key (client_id, firm_id) references public.clients (id, firm_id) on delete cascade
);
create index plans_client_idx on public.plans (client_id, updated_at desc);

-- Generic asset/liability rows. `type` is a key from the TypeScript asset
-- registry (src/lib/plan/asset-types.ts); type-specific fields live in
-- `metadata`, so new types (e.g. foreign real estate with a country) can be
-- added without a schema change.
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  plan_id uuid not null,
  side public.asset_side not null,
  type text not null check (type ~ '^[a-z0-9_]{1,64}$'),
  tax_box smallint check (tax_box in (1, 2, 3)),
  label text not null default '',
  value numeric(16, 2),
  metadata jsonb not null default '{}'::jsonb,
  source public.value_source not null default 'handmatig',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (plan_id, firm_id) references public.plans (id, firm_id) on delete cascade
);
create index assets_plan_idx on public.assets (plan_id, sort_order);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  plan_id uuid not null,
  type public.document_type not null,
  year integer check (year between 1990 and 2100),
  -- Path inside the private "documents" storage bucket.
  file_path text not null,
  file_name text not null,
  extraction_status public.extraction_status not null default 'in_behandeling',
  extracted_data jsonb,
  uploaded_by uuid references public.users (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  foreign key (plan_id, firm_id) references public.plans (id, firm_id) on delete cascade
);
create index documents_plan_idx on public.documents (plan_id, uploaded_at desc);

create table public.exports (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  plan_id uuid not null,
  -- Path inside the private "exports" storage bucket.
  pdf_path text not null,
  sections_included jsonb not null default '[]'::jsonb,
  house_style_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (plan_id, firm_id) references public.plans (id, firm_id) on delete cascade
);
create index exports_plan_idx on public.exports (plan_id, created_at desc);

-- Usage metadata only (no client names, amounts or document contents).
-- Feeds the super admin dashboard.
create table public.activity_log (
  id bigint generated always as identity primary key,
  firm_id uuid not null references public.firms (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null check (action ~ '^[a-z_]{1,64}$'),
  created_at timestamptz not null default now()
);
create index activity_log_firm_idx on public.activity_log (firm_id, created_at desc);
create index activity_log_created_idx on public.activity_log (created_at);

-- ---------------------------------------------------------------------------
-- Helper functions used by RLS policies
-- ---------------------------------------------------------------------------

create function public.current_firm_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select firm_id from public.users where id = auth.uid()
$$;

create function public.is_firm_owner() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'owner')
$$;

create function public.is_super_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.super_admins where user_id = auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Privileges: start from nothing, grant only what the app needs.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

grant select, update (name, website_url) on public.firms to authenticated;
grant select, update (name) on public.users to authenticated;
grant select, insert, delete on public.invitations to authenticated;
grant select, insert,
  update (logo_path, primary_color, secondary_color, accent_color, font_heading, font_body, layout_variant, updated_at)
  on public.house_styles to authenticated;
grant select, insert, update (first_name, last_name, company_name), delete on public.clients to authenticated;
grant select, insert, update (content), delete on public.client_notes to authenticated;
grant select, insert, update (title, status, current_step, config, inputs), delete on public.plans to authenticated;
grant select, insert, update (label, value, metadata, source, sort_order, tax_box), delete on public.assets to authenticated;
grant select, insert, update (extraction_status, extracted_data, year), delete on public.documents to authenticated;
grant select, insert on public.exports to authenticated;
-- activity_log and super_admins: no direct access at all.

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.firms enable row level security;
alter table public.users enable row level security;
alter table public.super_admins enable row level security;
alter table public.invitations enable row level security;
alter table public.house_styles enable row level security;
alter table public.clients enable row level security;
alter table public.client_notes enable row level security;
alter table public.plans enable row level security;
alter table public.assets enable row level security;
alter table public.documents enable row level security;
alter table public.exports enable row level security;
alter table public.activity_log enable row level security;

-- firms
create policy firms_select on public.firms for select to authenticated
  using (id = (select public.current_firm_id()));
create policy firms_update_owner on public.firms for update to authenticated
  using (id = (select public.current_firm_id()) and (select public.is_firm_owner()))
  with check (id = (select public.current_firm_id()));

-- users
create policy users_select_same_firm on public.users for select to authenticated
  using (firm_id = (select public.current_firm_id()));
create policy users_update_self on public.users for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- invitations (owner only)
create policy invitations_owner_select on public.invitations for select to authenticated
  using (firm_id = (select public.current_firm_id()) and (select public.is_firm_owner()));
create policy invitations_owner_insert on public.invitations for insert to authenticated
  with check (
    firm_id = (select public.current_firm_id())
    and (select public.is_firm_owner())
    and invited_by = (select auth.uid())
  );
create policy invitations_owner_delete on public.invitations for delete to authenticated
  using (firm_id = (select public.current_firm_id()) and (select public.is_firm_owner()));

-- house_styles (everyone in the firm reads, only the owner writes)
create policy house_styles_select on public.house_styles for select to authenticated
  using (firm_id = (select public.current_firm_id()));
create policy house_styles_owner_insert on public.house_styles for insert to authenticated
  with check (firm_id = (select public.current_firm_id()) and (select public.is_firm_owner()));
create policy house_styles_owner_update on public.house_styles for update to authenticated
  using (firm_id = (select public.current_firm_id()) and (select public.is_firm_owner()))
  with check (firm_id = (select public.current_firm_id()));

-- clients
create policy clients_select on public.clients for select to authenticated
  using (firm_id = (select public.current_firm_id()));
create policy clients_insert on public.clients for insert to authenticated
  with check (firm_id = (select public.current_firm_id()) and created_by = (select auth.uid()));
create policy clients_update on public.clients for update to authenticated
  using (firm_id = (select public.current_firm_id()))
  with check (firm_id = (select public.current_firm_id()));
create policy clients_delete_owner on public.clients for delete to authenticated
  using (firm_id = (select public.current_firm_id()) and (select public.is_firm_owner()));

-- client_notes (whole firm reads; author or owner edits/deletes)
create policy notes_select on public.client_notes for select to authenticated
  using (firm_id = (select public.current_firm_id()));
create policy notes_insert on public.client_notes for insert to authenticated
  with check (firm_id = (select public.current_firm_id()) and author_id = (select auth.uid()));
create policy notes_update on public.client_notes for update to authenticated
  using (
    firm_id = (select public.current_firm_id())
    and (author_id = (select auth.uid()) or (select public.is_firm_owner()))
  )
  with check (firm_id = (select public.current_firm_id()));
create policy notes_delete on public.client_notes for delete to authenticated
  using (
    firm_id = (select public.current_firm_id())
    and (author_id = (select auth.uid()) or (select public.is_firm_owner()))
  );

-- plans, assets, documents: full access within the firm
create policy plans_select on public.plans for select to authenticated
  using (firm_id = (select public.current_firm_id()));
create policy plans_insert on public.plans for insert to authenticated
  with check (firm_id = (select public.current_firm_id()) and created_by = (select auth.uid()));
create policy plans_update on public.plans for update to authenticated
  using (firm_id = (select public.current_firm_id()))
  with check (firm_id = (select public.current_firm_id()));
create policy plans_delete on public.plans for delete to authenticated
  using (firm_id = (select public.current_firm_id()));

create policy assets_all on public.assets for all to authenticated
  using (firm_id = (select public.current_firm_id()))
  with check (firm_id = (select public.current_firm_id()));

create policy documents_select on public.documents for select to authenticated
  using (firm_id = (select public.current_firm_id()));
create policy documents_insert on public.documents for insert to authenticated
  with check (firm_id = (select public.current_firm_id()) and uploaded_by = (select auth.uid()));
create policy documents_update on public.documents for update to authenticated
  using (firm_id = (select public.current_firm_id()))
  with check (firm_id = (select public.current_firm_id()));
create policy documents_delete on public.documents for delete to authenticated
  using (firm_id = (select public.current_firm_id()));

-- exports are immutable snapshots
create policy exports_select on public.exports for select to authenticated
  using (firm_id = (select public.current_firm_id()));
create policy exports_insert on public.exports for insert to authenticated
  with check (firm_id = (select public.current_firm_id()) and created_by = (select auth.uid()));

-- super_admins, activity_log: RLS on with no policies = no direct access.

-- ---------------------------------------------------------------------------
-- Triggers: timestamps
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger notes_set_updated_at before update on public.client_notes
  for each row execute function public.set_updated_at();
create trigger plans_set_updated_at before update on public.plans
  for each row execute function public.set_updated_at();
create trigger assets_set_updated_at before update on public.assets
  for each row execute function public.set_updated_at();
create trigger house_styles_set_updated_at before update on public.house_styles
  for each row execute function public.set_updated_at();

-- A change anywhere inside a client (notes, plans, assets, documents, exports)
-- counts as "last change" for the client list on the dashboard.
create function public.touch_client(p_client_id uuid) returns void
language sql security definer set search_path = ''
as $$
  update public.clients set updated_at = now() where id = p_client_id;
$$;

create function public.touch_parent_from_child() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  rec record;
begin
  if tg_op = 'DELETE' then
    rec := old;
  else
    rec := new;
  end if;

  if tg_table_name in ('plans', 'client_notes') then
    perform public.touch_client(rec.client_id);
  else
    -- assets / documents / exports hang off a plan; updating the plan in turn
    -- fires plans_touch_client.
    update public.plans set updated_at = now() where id = rec.plan_id;
  end if;
  return null;
end;
$$;

create trigger plans_touch_client after insert or update or delete on public.plans
  for each row execute function public.touch_parent_from_child();
create trigger notes_touch_client after insert or update or delete on public.client_notes
  for each row execute function public.touch_parent_from_child();
create trigger assets_touch_plan after insert or update or delete on public.assets
  for each row execute function public.touch_parent_from_child();
create trigger documents_touch_plan after insert or update or delete on public.documents
  for each row execute function public.touch_parent_from_child();
create trigger exports_touch_plan after insert on public.exports
  for each row execute function public.touch_parent_from_child();

-- ---------------------------------------------------------------------------
-- Triggers: activity log (metadata only)
-- ---------------------------------------------------------------------------

create function public.log_activity() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.activity_log (firm_id, user_id, action)
  values (new.firm_id, auth.uid(), tg_argv[0]);
  return null;
end;
$$;

create trigger clients_log after insert on public.clients
  for each row execute function public.log_activity('client_created');
create trigger plans_log after insert on public.plans
  for each row execute function public.log_activity('plan_created');
create trigger documents_log after insert on public.documents
  for each row execute function public.log_activity('document_uploaded');
create trigger exports_log after insert on public.exports
  for each row execute function public.log_activity('export_created');

-- Called by the app right after a successful login. Also accepts a pending
-- invitation for an existing account that is not linked to a firm yet (the
-- sign-up trigger below only covers brand-new accounts).
create function public.record_login() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_firm uuid;
  v_email text;
  v_name text;
  v_invitation public.invitations%rowtype;
begin
  update public.users set last_login_at = now() where id = auth.uid()
    returning firm_id into v_firm;

  if v_firm is null and auth.uid() is not null then
    select lower(email), coalesce(nullif(trim(raw_user_meta_data ->> 'name'), ''), split_part(email, '@', 1))
      into v_email, v_name
    from auth.users where id = auth.uid();

    select * into v_invitation
    from public.invitations
    where email = v_email and accepted_at is null
    order by created_at desc
    limit 1;

    if found then
      insert into public.users (id, firm_id, name, email, role, last_login_at)
      values (auth.uid(), v_invitation.firm_id, v_name, v_email, 'planner', now());
      update public.invitations set accepted_at = now() where id = v_invitation.id;
      insert into public.activity_log (firm_id, user_id, action) values (v_invitation.firm_id, auth.uid(), 'planner_joined');
      v_firm := v_invitation.firm_id;
    end if;
  end if;

  if v_firm is not null then
    insert into public.activity_log (firm_id, user_id, action) values (v_firm, auth.uid(), 'login');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- New auth user -> firm membership
--
-- 1. A pending invitation for this e-mail address -> join that firm as planner.
-- 2. Otherwise, sign-up metadata contains firm_name -> create a new firm with
--    this user as owner, plus a default house style.
-- 3. Otherwise -> no membership (e.g. the Plannr super admin account).
-- ---------------------------------------------------------------------------

create function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_invitation public.invitations%rowtype;
  v_firm_id uuid;
  v_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1));
  v_firm_name text := nullif(trim(new.raw_user_meta_data ->> 'firm_name'), '');
begin
  select * into v_invitation
  from public.invitations
  where email = lower(new.email) and accepted_at is null
  order by created_at desc
  limit 1;

  if found then
    insert into public.users (id, firm_id, name, email, role)
    values (new.id, v_invitation.firm_id, v_name, lower(new.email), 'planner');
    update public.invitations set accepted_at = now() where id = v_invitation.id;
    insert into public.activity_log (firm_id, user_id, action)
    values (v_invitation.firm_id, new.id, 'planner_joined');
  elsif v_firm_name is not null then
    insert into public.firms (name) values (left(v_firm_name, 200)) returning id into v_firm_id;
    insert into public.users (id, firm_id, name, email, role)
    values (new.id, v_firm_id, v_name, lower(new.email), 'owner');
    insert into public.house_styles (firm_id) values (v_firm_id);
    insert into public.activity_log (firm_id, user_id, action)
    values (v_firm_id, new.id, 'firm_created');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Super admin dashboard (usage metadata only — never client data)
-- ---------------------------------------------------------------------------

create function public.assert_super_admin() returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
end;
$$;

create function public.admin_totals()
returns table (firms bigint, planners bigint, clients bigint, plans bigint, exports bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  return query select
    (select count(*) from public.firms),
    (select count(*) from public.users),
    (select count(*) from public.clients),
    (select count(*) from public.plans),
    (select count(*) from public.exports);
end;
$$;

create function public.admin_firm_stats()
returns table (
  firm_id uuid,
  firm_name text,
  signed_up_at timestamptz,
  seats bigint,
  clients bigint,
  plans bigint,
  exports bigint,
  last_login_at timestamptz,
  last_activity_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  return query
  select
    f.id,
    f.name,
    f.created_at,
    (select count(*) from public.users u where u.firm_id = f.id),
    (select count(*) from public.clients c where c.firm_id = f.id),
    (select count(*) from public.plans p where p.firm_id = f.id),
    (select count(*) from public.exports e where e.firm_id = f.id),
    (select max(u.last_login_at) from public.users u where u.firm_id = f.id),
    greatest(
      (select max(a.created_at) from public.activity_log a where a.firm_id = f.id),
      (select max(p.updated_at) from public.plans p where p.firm_id = f.id),
      (select max(c.updated_at) from public.clients c where c.firm_id = f.id)
    )
  from public.firms f
  order by f.created_at desc;
end;
$$;

create function public.admin_monthly_stats(p_months integer default 12)
returns table (month date, new_firms bigint, active_firms bigint, exports bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  return query
  with months as (
    select generate_series(
      date_trunc('month', now()) - make_interval(months => greatest(p_months, 1) - 1),
      date_trunc('month', now()),
      interval '1 month'
    )::date as m
  )
  select
    months.m,
    (select count(*) from public.firms f where date_trunc('month', f.created_at)::date = months.m),
    (select count(distinct a.firm_id) from public.activity_log a where date_trunc('month', a.created_at)::date = months.m),
    (select count(*) from public.exports e where date_trunc('month', e.created_at)::date = months.m)
  from months
  order by months.m;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: Supabase grants EXECUTE on new functions to everyone by
-- default. Revoke all of it, then allow only what the app calls via RPC.
-- (Trigger functions fire regardless of EXECUTE privileges.)
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.current_firm_id() to authenticated;
grant execute on function public.is_firm_owner() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.record_login() to authenticated;
grant execute on function public.admin_totals() to authenticated;
grant execute on function public.admin_firm_stats() to authenticated;
grant execute on function public.admin_monthly_stats(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private buckets, one folder per firm: <firm_id>/...
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 20971520, array['application/pdf', 'image/png', 'image/jpeg']),
  ('exports', 'exports', false, 20971520, array['application/pdf']),
  ('logos', 'logos', false, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "plannr: firm reads own files" on storage.objects for select to authenticated
  using (
    bucket_id in ('documents', 'exports', 'logos')
    and (storage.foldername(name))[1] = (select public.current_firm_id())::text
  );

create policy "plannr: firm uploads documents and exports" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('documents', 'exports')
    and (storage.foldername(name))[1] = (select public.current_firm_id())::text
  );

create policy "plannr: firm deletes own documents" on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.current_firm_id())::text
  );

create policy "plannr: owner deletes exports" on storage.objects for delete to authenticated
  using (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] = (select public.current_firm_id())::text
    and (select public.is_firm_owner())
  );

create policy "plannr: owner uploads logo" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select public.current_firm_id())::text
    and (select public.is_firm_owner())
  );

create policy "plannr: owner replaces logo" on storage.objects for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select public.current_firm_id())::text
    and (select public.is_firm_owner())
  );

create policy "plannr: owner deletes logo" on storage.objects for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select public.current_firm_id())::text
    and (select public.is_firm_owner())
  );
