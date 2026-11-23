-- Gligor.ai admin dashboard: volledig schema.
-- Alle tabellen staan in "public", met Row Level Security. Alleen de ene
-- beheerder (tabel admins) met een tweede factor (aal2) mag iets lezen of wijzigen.
-- Webhooks en de dagelijkse job draaien als database-eigenaar en omzeilen RLS.


-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type client_stage as enum (
  'lead', 'kennismaking', 'intake', 'inrichting', 'training', 'checkin', 'doorlopend', 'opgezegd'
);
create type package_type as enum ('basis', 'plus');
create type contact_channel as enum ('email', 'telefoon', 'whatsapp');
create type setup_type as enum ('microsoft365', 'claude');
create type log_type as enum ('gesprek', 'telefoon', 'email', 'bezoek', 'notitie');
create type ticket_status as enum ('nieuw', 'open', 'wacht_op_klant', 'opgelost');
create type payment_kind as enum ('startbedrag', 'maand');
create type email_status as enum ('concept', 'gepland', 'verzonden', 'mislukt', 'geannuleerd');
create type task_status as enum ('open', 'klaar');

-- ---------------------------------------------------------------------------
-- Beheerder
-- ---------------------------------------------------------------------------
-- Precies één rij: de eerste (en enige) toegestane login. De app vult hem bij
-- de eerste login met het adres uit ADMIN_EMAIL.
create table admins (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique,
  email text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- ---------------------------------------------------------------------------
-- Klanten
-- ---------------------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  sector text,
  city text,
  owner_name text not null default '',
  email text,
  phone text,
  preferred_channel contact_channel not null default 'email',
  package package_type not null default 'basis',
  monthly_fee numeric(10, 2) not null default 100,
  start_fee numeric(10, 2) not null default 250,
  start_date date,
  end_date date,
  setup_type setup_type,
  users_count integer not null default 1 check (users_count >= 0),
  stage client_stage not null default 'lead',
  stage_changed_at timestamptz not null default now(),
  notes text not null default '',
  tags text[] not null default '{}',
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clients_email_unique on clients (lower(email)) where email is not null and email <> '';
create index clients_stage_idx on clients (stage);

create table client_stage_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  from_stage client_stage,
  to_stage client_stage not null,
  changed_at timestamptz not null default now()
);
create index client_stage_history_client_idx on client_stage_history (client_id, changed_at);

-- ---------------------------------------------------------------------------
-- Logboek en taken
-- ---------------------------------------------------------------------------
create table log_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  type log_type not null default 'notitie',
  summary text not null,
  agreed_actions text not null default '',
  follow_up_date date,
  follow_up_done boolean not null default false,
  source text not null default 'handmatig' check (source in ('handmatig', 'email_in', 'email_uit', 'systeem')),
  email_id uuid,
  ticket_id uuid,
  created_at timestamptz not null default now()
);
create index log_entries_client_idx on log_entries (client_id, occurred_at desc);
create index log_entries_follow_up_idx on log_entries (follow_up_date) where follow_up_date is not null and not follow_up_done;

create table tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients (id) on delete cascade,
  title text not null,
  due_date date,
  status task_status not null default 'open',
  source text not null default 'handmatig' check (source in ('handmatig', 'logboek', 'levenscyclus', 'systeem')),
  -- Zorgt dat automatische taken nooit dubbel aangemaakt worden.
  automation_key text unique,
  log_entry_id uuid references log_entries (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index tasks_open_idx on tasks (due_date) where status = 'open';
create index tasks_client_idx on tasks (client_id);

-- ---------------------------------------------------------------------------
-- E-mail: sjablonen en uitgaande post
-- ---------------------------------------------------------------------------
create table email_templates (
  key text primary key,
  name text not null,
  stage client_stage,
  subject text not null,
  body text not null,
  auto_send boolean not null default false,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  number integer generated always as identity (start with 1001) unique,
  client_id uuid references clients (id) on delete cascade,
  subject text not null default '(geen onderwerp)',
  status ticket_status not null default 'nieuw',
  -- Moment van het oudste nog onbeantwoorde bericht van de klant (null = niets openstaand).
  awaiting_since timestamptz,
  first_response_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_status_idx on tickets (status);
create index tickets_client_idx on tickets (client_id);

create table emails (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients (id) on delete cascade,
  ticket_id uuid references tickets (id) on delete set null,
  template_key text references email_templates (key) on delete set null,
  kind text not null default 'sjabloon' check (kind in ('sjabloon', 'ticket', 'herinnering', 'nieuwsbrief', 'digest', 'los')),
  to_email text not null,
  subject text not null,
  body text not null,
  status email_status not null default 'concept',
  scheduled_for timestamptz,
  sent_at timestamptz,
  message_id text,
  provider_id text,
  error text,
  automation_key text unique,
  payment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index emails_status_idx on emails (status, scheduled_for);
create index emails_client_idx on emails (client_id);

create table ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets (id) on delete cascade,
  direction text not null check (direction in ('in', 'uit')),
  from_email text not null,
  to_email text not null,
  subject text not null default '',
  body_text text not null default '',
  body_html text,
  message_id text,
  in_reply_to text,
  references_header text,
  email_id uuid references emails (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ticket_messages_ticket_idx on ticket_messages (ticket_id, created_at);
create unique index ticket_messages_message_id_idx on ticket_messages (message_id) where message_id is not null;

create table ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references ticket_messages (id) on delete cascade,
  filename text not null,
  content_type text not null default 'application/octet-stream',
  size_bytes integer not null default 0,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table log_entries add constraint log_entries_email_fk foreign key (email_id) references emails (id) on delete set null;
alter table log_entries add constraint log_entries_ticket_fk foreign key (ticket_id) references tickets (id) on delete set null;

create table newsletters (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  recipients integer not null default 0,
  sent_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Betalingen (alleen status; Stripe kan later via external_* gekoppeld worden)
-- ---------------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  kind payment_kind not null,
  period_start date not null,
  due_date date not null,
  amount numeric(10, 2) not null,
  paid_at date,
  cancelled boolean not null default false,
  source text not null default 'handmatig' check (source in ('handmatig', 'stripe')),
  external_provider text,
  external_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, kind, period_start)
);
create index payments_due_idx on payments (due_date) where paid_at is null and not cancelled;

alter table emails add constraint emails_payment_fk foreign key (payment_id) references payments (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Overig
-- ---------------------------------------------------------------------------
-- "Snooze" voor items in de Vandaag-lijst, bijvoorbeeld 'ticket:<id>'.
create table snoozes (
  item_key text primary key,
  until date not null
);

create table settings (
  key text primary key,
  value jsonb not null
);

create table audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  client_id uuid,
  action text not null,
  actor uuid,
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);
create index audit_log_client_idx on audit_log (client_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger clients_touch before update on clients for each row execute function touch_updated_at();
create trigger tickets_touch before update on tickets for each row execute function touch_updated_at();
create trigger emails_touch before update on emails for each row execute function touch_updated_at();
create trigger payments_touch before update on payments for each row execute function touch_updated_at();
create trigger templates_touch before update on email_templates for each row execute function touch_updated_at();

-- Laatste contactmoment bijhouden voor "Even bijpraten?".
create or replace function public.bump_last_contact() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update clients
     set last_contact_at = greatest(coalesce(last_contact_at, new.occurred_at), new.occurred_at)
   where id = new.client_id and new.source <> 'systeem';
  return new;
end;
$$;
create trigger log_entries_contact after insert on log_entries for each row execute function bump_last_contact();

-- Auditlog: elke wijziging aan klantgegevens, logboek en betalingen.
create or replace function public.write_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb;
  cid uuid;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  cid := case when tg_table_name = 'clients' then (rec ->> 'id')::uuid else (rec ->> 'client_id')::uuid end;
  -- Alleen het tijdstempel veranderd? Dan niets loggen.
  if tg_op = 'UPDATE' and (to_jsonb(old) - 'updated_at' - 'last_contact_at') = (to_jsonb(new) - 'updated_at' - 'last_contact_at') then
    return new;
  end if;
  insert into audit_log (table_name, record_id, client_id, action, actor, old_data, new_data)
  values (
    tg_table_name,
    (rec ->> 'id')::uuid,
    cid,
    lower(tg_op),
    auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;
create trigger clients_audit after insert or update or delete on clients for each row execute function write_audit();
create trigger log_entries_audit after insert or update or delete on log_entries for each row execute function write_audit();
create trigger payments_audit after insert or update or delete on payments for each row execute function write_audit();

-- AVG: alle gegevens van één klant verwijderen. De auditregels blijven bestaan
-- (wat er wanneer gebeurde), maar zonder persoonsgegevens.
create or replace function public.forget_client(p_client_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Via de app (rol "authenticated") alleen voor de beheerder; de server zelf
  -- (zonder rolwissel) mag altijd.
  if current_setting('role', true) = 'authenticated' and not public.is_admin() then
    raise exception 'geen toegang';
  end if;
  delete from clients where id = p_client_id;
  update audit_log set old_data = null, new_data = null where client_id = p_client_id;
  insert into audit_log (table_name, record_id, client_id, action, actor)
  values ('clients', p_client_id, p_client_id, 'vergeten (AVG)', auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'admins', 'clients', 'client_stage_history', 'log_entries', 'tasks', 'email_templates', 'tickets',
    'emails', 'ticket_messages', 'ticket_attachments', 'newsletters', 'payments', 'snoozes', 'settings', 'audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
  end loop;

  -- Volledige toegang voor de beheerder (met 2FA) op alle werktabellen.
  foreach t in array array[
    'clients', 'client_stage_history', 'log_entries', 'tasks', 'email_templates', 'tickets',
    'emails', 'ticket_messages', 'ticket_attachments', 'newsletters', 'payments', 'snoozes', 'settings'
  ] loop
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format(
      'create policy %I on %I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin', t
    );
  end loop;
end;
$$;

-- Beheerderstabel: alleen lezen (de rij wordt server-side aangemaakt).
grant select on admins to authenticated;
create policy admins_self on admins for select to authenticated using (user_id = auth.uid());

-- Auditlog: alleen lezen, nooit wijzigen of wissen via de app.
grant select on audit_log to authenticated;
create policy audit_log_read on audit_log for select to authenticated using (public.is_admin());

grant execute on function public.is_admin() to authenticated;
grant execute on function public.forget_client(uuid) to authenticated;
revoke execute on function public.forget_client(uuid) from anon, public;
