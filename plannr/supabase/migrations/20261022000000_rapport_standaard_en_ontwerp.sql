-- Firm default for which report sections a new plan starts with.
-- Null: Plannr's default list.
alter table public.firms add column if not exists rapport_secties_standaard text[];

grant update (rapport_secties_standaard) on public.firms to authenticated;
