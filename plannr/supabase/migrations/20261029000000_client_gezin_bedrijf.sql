-- New-client form: birth year (age is shown from it) and whether the client
-- has a company. Only clients with a company get the "Zakelijk" step.
alter table public.clients
  add column if not exists geboortejaar integer,
  add column if not exists heeft_bedrijf boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_geboortejaar_check') then
    alter table public.clients add constraint clients_geboortejaar_check
      check (geboortejaar is null or geboortejaar between 1900 and 2100);
  end if;
end $$;

-- Existing clients with a company name have a company.
update public.clients set heeft_bedrijf = true where company_name is not null and not heeft_bedrijf;

grant update (geboortejaar, heeft_bedrijf) on public.clients to authenticated;
