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
