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
