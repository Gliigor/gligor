-- Firm default for which report sections a new plan starts with.
-- Null: Plannr's default list.
alter table public.firms add column if not exists rapport_secties_standaard text[];

grant update (rapport_secties_standaard) on public.firms to authenticated;

-- Building blocks of the report design, e.g. {"cover": "kader", "opener": "lijn", "panel": "papier"}.
-- Null: derived from layout_variant.
alter table public.house_styles add column if not exists ontwerp jsonb;

grant update (ontwerp) on public.house_styles to authenticated;

-- AI design attempts left per firm. Users cannot write this column; it only
-- changes through the functions below.
alter table public.firms add column if not exists ontwerp_pogingen integer not null default 3;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'firms_ontwerp_pogingen_check') then
    alter table public.firms add constraint firms_ontwerp_pogingen_check check (ontwerp_pogingen >= 0);
  end if;
end $$;

-- Uses one attempt of the caller's firm (owners only). Returns what is left,
-- or -1 when there was none left.
create or replace function public.take_design_attempt() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  left_over integer;
begin
  if not public.is_firm_owner() then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  update public.firms set ontwerp_pogingen = ontwerp_pogingen - 1
  where id = public.current_firm_id() and ontwerp_pogingen > 0
  returning ontwerp_pogingen into left_over;
  return coalesce(left_over, -1);
end;
$$;

-- Super admin: give a firm extra attempts.
create or replace function public.admin_add_design_attempts(p_firm_id uuid, p_count integer) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  total integer;
begin
  perform public.assert_super_admin();
  if p_count is null or p_count < 1 or p_count > 20 then
    raise exception 'Ongeldig aantal' using errcode = '22023';
  end if;
  update public.firms set ontwerp_pogingen = ontwerp_pogingen + p_count
  where id = p_firm_id
  returning ontwerp_pogingen into total;
  return total;
end;
$$;

-- Super admin: attempts left per firm (the admin cannot read firms directly).
create or replace function public.admin_design_attempts()
returns table (firm_id uuid, pogingen integer)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  return query select f.id, f.ontwerp_pogingen from public.firms f;
end;
$$;

revoke execute on function public.take_design_attempt() from public, anon;
revoke execute on function public.admin_add_design_attempts(uuid, integer) from public, anon;
revoke execute on function public.admin_design_attempts() from public, anon;
grant execute on function public.take_design_attempt() to authenticated;
grant execute on function public.admin_add_design_attempts(uuid, integer) to authenticated;
grant execute on function public.admin_design_attempts() to authenticated;
