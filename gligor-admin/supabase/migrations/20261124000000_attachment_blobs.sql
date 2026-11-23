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
