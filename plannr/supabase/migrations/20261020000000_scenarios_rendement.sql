-- Scenarios: a plan can be a copy ("scenario") of another plan of the same firm.
-- Deleting the base plan keeps its scenarios as ordinary plans.
alter table public.plans add column if not exists scenario_van uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plans_scenario_van_fkey') then
    alter table public.plans
      add constraint plans_scenario_van_fkey
      foreign key (scenario_van, firm_id) references public.plans (id, firm_id)
      on delete set null (scenario_van);
  end if;
end $$;

create index if not exists plans_scenario_van_idx on public.plans (scenario_van);

-- Firm defaults for the realistic expected returns (percent per kind of wealth),
-- e.g. {"beleggingen": 4.5, "sparen": 1.5}. Null: Plannr's defaults.
alter table public.firms add column if not exists rendement_standaard jsonb;

grant update (rendement_standaard) on public.firms to authenticated;
