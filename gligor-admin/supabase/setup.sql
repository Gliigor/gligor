-- Gligor.ai admin: volledige database-opzet in één keer.
-- Plak dit in Supabase → SQL Editor → New query → Run. Eenmalig uitvoeren op een leeg project.

-- ===== 20261123000000_admin_schema.sql =====
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
  -- Via de API (rol anon/authenticated) alleen voor de beheerder met 2FA; de
  -- server zelf (eigen verbinding, zonder rolwissel) mag altijd.
  if coalesce(current_setting('role', true), 'none') in ('anon', 'authenticated') and not public.is_admin() then
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

-- ===== 20261123000100_starter_templates.sql =====
-- Startsjablonen (Nederlands). Gligor kan ze daarna aanpassen in "Templates".
-- Variabelen: {{voornaam}}, {{naam}}, {{bedrijf}}, {{pakket}}, {{maandbedrag}}, {{startdatum}},
-- en bij de betaalherinnering ook {{bedrag}}, {{omschrijving}}, {{vervaldatum}}.

insert into email_templates (key, name, stage, subject, body, sort) values
(
  'welkom', 'Welkom na kennismaking', 'intake',
  'Fijn kennisgemaakt, {{voornaam}}!',
  $t$Hoi {{voornaam}},

Dank je wel voor het fijne gesprek. Leuk om te horen hoe het er bij {{bedrijf}} aan toe gaat, en ik denk echt dat AI je daar tijd kan besparen.

Zoals besproken plannen we nu de intake. Daarin kijken we samen naar je werkdag: waar gaat de tijd naartoe, en wat kan AI overnemen? Neem gerust een paar voorbeelden mee van mails, offertes of documenten waar je veel tijd aan kwijt bent.

Je zit op het pakket {{pakket}} ({{maandbedrag}} per maand, maandelijks opzegbaar). Daar komt eenmalig het startbedrag bij voor de inrichting en de starttraining. En met de tijdbespaargarantie loop je geen risico.

Vragen? Mail of app gerust.

Hartelijke groet,
Gligor$t$,
  10
),
(
  'bevestiging_intake', 'Bevestiging intake', 'inrichting',
  'Wat we hebben afgesproken bij de intake',
  $t$Hoi {{voornaam}},

Dank voor de intake. Hieronder kort wat we hebben afgesproken, zodat we allebei hetzelfde voor ogen hebben.

Wat ik ga doen:
- De AI-tools voor {{bedrijf}} inrichten
- Spiekbriefjes op maat maken voor jullie eigen werk
- De starttraining voorbereiden

Wat ik van jou nodig heb:
- Toegang tot de accounts die we besproken hebben (of een moment waarop we dat samen doen)
- Een paar voorbeelden van terugkerend werk

Je startdatum is {{startdatum}}. Ik laat het weten zodra alles klaarstaat.

Groet,
Gligor$t$,
  20
),
(
  'inrichting_klaar', 'Inrichting klaar + spiekbriefjes', 'training',
  'Alles staat klaar, {{voornaam}}',
  $t$Hoi {{voornaam}},

Goed nieuws: de AI-tools voor {{bedrijf}} zijn ingericht. In de bijlage vind je de spiekbriefjes met kant-en-klare werkwijzen voor jullie eigen werk. Print ze gerust uit en leg ze naast het toetsenbord.

Tijdens de starttraining lopen we alles samen door, met jullie eigen voorbeelden. Daarna kun je meteen aan de slag.

Tot snel!
Gligor$t$,
  30
),
(
  'checkin_2w', 'Check-in na 2 weken', 'training',
  'Hoe gaat het met AI bij {{bedrijf}}?',
  $t$Hoi {{voornaam}},

Je werkt nu zo'n twee weken met de AI-tools. Hoe bevalt het?

Ik ben benieuwd:
- Welke taken gaan al sneller?
- Waar loop je nog tegenaan?
- Is er iets wat je vaker doet en waar we een spiekbriefje voor kunnen maken?

Een korte reactie is genoeg. Liever even bellen? Laat maar weten wanneer het uitkomt.

Groet,
Gligor$t$,
  40
),
(
  'garantie_4w', 'Garantie-evaluatie na 4 weken', 'checkin',
  'Tijd voor de check-in: wat heeft het je opgeleverd?',
  $t$Hoi {{voornaam}},

Je eerste maand zit erop. Tijd om samen te kijken wat AI je heeft opgeleverd.

Zoals beloofd meten we de besparing samen. Bespaar je minder dan 4 uur, terwijl je de training hebt gevolgd en de tools gebruikt? Dan krijg je je startbedrag volledig terug.

Wil je alvast nadenken over:
- Welke taken je nu sneller doet, en hoeveel tijd dat ongeveer scheelt
- Wat je nog graag slimmer zou willen doen

Ik plan een kort moment met je in. Komt het je deze week uit?

Groet,
Gligor$t$,
  50
),
(
  'kwartaal_update', 'Kwartaal-update (Plus)', 'doorlopend',
  'Kwartaal-update: welk proces pakken we nu aan?',
  $t$Hoi {{voornaam}},

Er is weer een kwartaal voorbij. Met je Plus-pakket pakken we elk kwartaal samen een nieuw proces aan bij {{bedrijf}}.

Waar ben je op dit moment de meeste tijd aan kwijt? Denk aan offertes, administratie, klantvragen of social media. Laat het me weten, dan kom ik met een voorstel.

Ook deel ik graag kort welke nieuwe AI-functies voor jou interessant zijn.

Groet,
Gligor$t$,
  60
),
(
  'betaalherinnering', 'Vriendelijke betaalherinnering', null,
  'Herinnering: {{omschrijving}}',
  $t$Hoi {{voornaam}},

Een vriendelijke herinnering: ik heb de betaling voor "{{omschrijving}}" van {{bedrag}} (vervaldatum {{vervaldatum}}) nog niet binnen.

Waarschijnlijk is het er gewoon even bij ingeschoten. Zou je ernaar willen kijken? Heb je het al betaald, dan kun je deze mail negeren.

Dank je wel!
Gligor$t$,
  70
)
on conflict (key) do nothing;

-- ===== 20261123000200_storage_bucket.sql =====
-- Privé-bucket voor ticketbijlagen (alleen op Supabase; lokaal/PGlite bestaat
-- het storage-schema niet en wordt dit overgeslagen). Er zijn bewust GEEN
-- storage-policies: alleen de server (met de secret key) kan erbij, en de
-- beheerder downloadt via een kortlevende ondertekende link.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('ticket-bijlagen', 'ticket-bijlagen', false, 26214400)
    on conflict (id) do nothing;
  end if;
end;
$$;

-- ===== 20261124000000_attachment_blobs.sql =====
-- Bijlagen in de database (gebruikt zolang SUPABASE_SECRET_KEY niet is ingesteld).
create table if not exists attachment_blobs (
  storage_path text primary key,
  content_type text not null default 'application/octet-stream',
  data bytea not null,
  created_at timestamptz not null default now()
);
alter table attachment_blobs enable row level security;
revoke all on attachment_blobs from anon;
grant select, insert, update, delete on attachment_blobs to authenticated;
drop policy if exists attachment_blobs_admin on attachment_blobs;
create policy attachment_blobs_admin on attachment_blobs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ===== 20261124000100_intake_loyalty.sql =====
-- Intakeformulier, websiteleads, verjaardagen, mijlpalen, referrals en cadeaus.

-- ---------------------------------------------------------------------------
-- Klanten: extra velden
-- ---------------------------------------------------------------------------
alter table clients
  add column first_name text not null default '',
  add column last_name text not null default '',
  -- Bedrijfsadres (facturen en kaartjes) en eventueel een ander adres voor de kaart.
  add column address text not null default '',
  add column card_address text not null default '',
  -- Verjaardag: alleen dag en maand (geen geboortejaar, AVG), en alleen met toestemming gebruiken.
  add column birthday_day smallint check (birthday_day between 1 and 31),
  add column birthday_month smallint check (birthday_month between 1 and 12),
  add column birthday_consent boolean not null default false,
  add column gift_ideas text not null default '',
  add column referred_by uuid references clients (id) on delete set null,
  add column referral_succeeded_at date,
  add column lead_source text not null default 'handmatig'
    check (lead_source in ('handmatig', 'website', 'cal', 'email', 'intakelink')),
  add constraint clients_birthday_pair check ((birthday_day is null) = (birthday_month is null)),
  add constraint clients_not_self_referred check (referred_by is null or referred_by <> id);
create index clients_referred_by_idx on clients (referred_by) where referred_by is not null;

-- Taken: ook mijlpalen en leads als bron.
alter table tasks drop constraint tasks_source_check;
alter table tasks add constraint tasks_source_check
  check (source in ('handmatig', 'logboek', 'levenscyclus', 'systeem', 'mijlpaal', 'lead'));
-- Extra uitleg (bijv. het adres voor een kaartje) en een link om direct naartoe te gaan.
alter table tasks add column details text not null default '', add column href text;

-- ---------------------------------------------------------------------------
-- E-mail: afzender per sjabloon en een opgemaakte HTML-versie
-- ---------------------------------------------------------------------------
alter table email_templates add column from_email text;
alter table emails add column from_email text;
alter table emails drop constraint emails_kind_check;
alter table emails add constraint emails_kind_check
  check (kind in ('sjabloon', 'ticket', 'herinnering', 'nieuwsbrief', 'digest', 'los', 'mijlpaal', 'intakelink'));

-- ---------------------------------------------------------------------------
-- Betalingen: tegoeden (gratis maand via referral)
-- ---------------------------------------------------------------------------
alter table payments add column credit_reason text;
alter table payments drop constraint payments_source_check;
alter table payments add constraint payments_source_check check (source in ('handmatig', 'stripe', 'tegoed'));

-- Een tegoed wacht tot er een openstaande maandbetaling is om mee te verrekenen.
create table payment_credits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  reason text not null,
  automation_key text unique,
  applied_payment_id uuid references payments (id) on delete set null,
  applied_at date,
  created_at timestamptz not null default now()
);
create index payment_credits_open_idx on payment_credits (client_id) where applied_payment_id is null;

-- ---------------------------------------------------------------------------
-- Cadeaus, kaarten en diners (voor de boekhouding)
-- ---------------------------------------------------------------------------
create table gifts (
  id uuid primary key default gen_random_uuid(),
  -- Blijft staan na een AVG-verwijdering (zonder klant), want de kosten horen in de boekhouding.
  client_id uuid references clients (id) on delete set null,
  client_label text not null default '',
  given_on date not null,
  type text not null check (type in ('kaart', 'cadeau', 'diner')),
  description text not null default '',
  amount numeric(10, 2) not null default 0 check (amount >= 0),
  log_entry_id uuid references log_entries (id) on delete set null,
  created_at timestamptz not null default now()
);
create index gifts_given_on_idx on gifts (given_on);
create trigger gifts_audit after insert or update or delete on gifts for each row execute function write_audit();

-- ---------------------------------------------------------------------------
-- Intakelinks: eenmalig, 7 dagen geldig. Alleen een hash van het token wordt bewaard.
-- ---------------------------------------------------------------------------
create table intake_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  client_id uuid references clients (id) on delete cascade,
  email text not null,
  expires_at timestamptz not null,
  submitted_at timestamptz,
  data jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Eenvoudige limiet voor de publieke formulieren (alleen een hash van het IP-adres).
create table form_hits (
  id bigint generated always as identity primary key,
  bucket text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index form_hits_lookup_idx on form_hits (bucket, ip_hash, created_at);

-- ---------------------------------------------------------------------------
-- AVG-verwijdering: cadeauregels anonimiseren, intakelinks gaan mee
-- ---------------------------------------------------------------------------
create or replace function public.forget_client(p_client_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('role', true), 'none') in ('anon', 'authenticated') and not public.is_admin() then
    raise exception 'geen toegang';
  end if;
  update gifts set client_label = '(verwijderde klant)', description = '' where client_id = p_client_id;
  update clients set referred_by = null where referred_by = p_client_id;
  delete from clients where id = p_client_id;
  update audit_log set old_data = null, new_data = null where client_id = p_client_id;
  insert into audit_log (table_name, record_id, client_id, action, actor)
  values ('clients', p_client_id, p_client_id, 'vergeten (AVG)', auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security voor de nieuwe tabellen
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['payment_credits', 'gifts', 'intake_links', 'form_hits'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format(
      'create policy %I on %I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nieuwe sjablonen (warm en persoonlijk; aan te passen in Templates)
-- ---------------------------------------------------------------------------
insert into email_templates (key, name, stage, subject, body, from_email, sort) values
(
  'bedankt_3', 'Bedankt na 3 betalingen', null,
  'Bedankt, {{voornaam}}!',
  $t$Hoi {{voornaam}},

Inmiddels werken we alweer een paar maanden samen, en dat wil ik niet zomaar voorbij laten gaan. Bedankt dat je voor Gligor.ai hebt gekozen en dat je me het vertrouwen geeft om met je mee te denken.

Ik vind het echt mooi om te zien hoe {{bedrijf}} steeds meer uit AI haalt. Heb je vragen, ideeën of iets wat beter kan? Laat het me gerust weten, daar ben ik voor.

Nogmaals bedankt, ik waardeer het enorm.

Hartelijke groet,
Gligor
gligor@gligor.ai$t$,
  'gligor@gligor.ai', 80
),
(
  'jubileum', 'Een jaar samen', null,
  'Al een jaar samen — bedankt, {{voornaam}}!',
  $t$Hoi {{voornaam}},

Vandaag is het precies een jaar geleden dat we begonnen. Wat gaat dat snel.

In dat jaar heeft {{bedrijf}} AI echt een plek gegeven in het werk, en ik ben er trots op dat ik daarbij mocht helpen. Dank je wel voor je vertrouwen, je vragen en de fijne samenwerking.

Op naar het volgende jaar!

Hartelijke groet,
Gligor
gligor@gligor.ai$t$,
  'gligor@gligor.ai', 81
),
(
  'jubileum_jaarlijks', 'Weer een jaar samen', null,
  'Alweer {{jaren}} jaar samen, {{voornaam}}!',
  $t$Hoi {{voornaam}},

Alweer {{jaren}} jaar werken we samen, ondertussen {{maanden_klant}} maanden. Dank je wel dat je {{bedrijf}} aan mij blijft toevertrouwen.

Heb je ideeën voor wat AI het komende jaar nog meer voor je kan doen? Ik denk graag met je mee.

Hartelijke groet,
Gligor
gligor@gligor.ai$t$,
  'gligor@gligor.ai', 82
),
(
  'verjaardag', 'Verjaardag', null,
  'Gefeliciteerd, {{voornaam}}! 🎉',
  $t$Hoi {{voornaam}},

Van harte gefeliciteerd met je verjaardag! Ik hoop dat je een mooie dag hebt, en even tijd voor jezelf in plaats van voor de zaak.

Geniet ervan!

Hartelijke groet,
Gligor$t$,
  'gligor@gligor.ai', 83
),
(
  'referral_bedankt', 'Bedankt voor de aanbeveling', null,
  'Dank je wel voor de aanbeveling, {{voornaam}}!',
  $t$Hoi {{voornaam}},

Dankzij jou is {{aangebracht_bedrijf}} nu ook klant bij Gligor.ai. Wat fijn dat je me hebt aanbevolen, daar ben ik echt blij mee.

Als bedankje is je volgende maand gratis. Je ziet het terug op je volgende factuur.

Hartelijke groet,
Gligor
gligor@gligor.ai$t$,
  'gligor@gligor.ai', 84
),
(
  'intakelink', 'Intakeformulier (link)', null,
  'Je intakeformulier voor Gligor.ai',
  $t$Hoi {{voornaam}},

Zoals besproken: via de link hieronder vul je in een paar minuten het intakeformulier in. Dan kan ik de intake goed voorbereiden.

{{link}}

De link werkt één keer en is 7 dagen geldig.

Hartelijke groet,
Gligor$t$,
  null, 85
);

-- Instellingen voor mijlpalen (aan te passen in Instellingen).
insert into settings (key, value) values ('mijlpalen', '{
  "thanksAfterPayments": 3,
  "giftWeeksBefore": 4,
  "anniversaryReminderDays": 7,
  "birthdayCardDaysBefore": 7,
  "referralMonths": 2,
  "referralDinnerAt": 5
}'::jsonb) on conflict (key) do nothing;
