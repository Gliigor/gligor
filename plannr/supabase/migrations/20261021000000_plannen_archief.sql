-- Archived plans: hidden from the plan list but kept, and can be restored.
alter table public.plans add column if not exists gearchiveerd_op timestamptz;

grant update (gearchiveerd_op) on public.plans to authenticated;
