-- RLS / trigger tests. Run with tests/db/run.sh (needs Docker).
-- Every assertion failure aborts the run with a message.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres): two firms via sign-up metadata, one invited planner.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'eigenaar@a.nl', '{"name":"Eigenaar A","firm_name":"Kantoor A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'eigenaar@b.nl', '{"name":"Eigenaar B","firm_name":"Kantoor B"}');

insert into public.invitations (firm_id, email, invited_by)
select firm_id, 'planner@a.nl', id from public.users where email = 'eigenaar@a.nl';

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a2', 'Planner@A.nl', '{"name":"Planner A"}'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@plannr.test', '{}');
insert into public.super_admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');

do $$
begin
  assert (select count(*) from public.firms) = 2, 'two firms created';
  assert (select role from public.users where email = 'eigenaar@a.nl') = 'owner', 'owner role';
  assert (select role from public.users where email = 'planner@a.nl') = 'planner', 'planner role';
  assert (select firm_id from public.users where email = 'planner@a.nl')
       = (select firm_id from public.users where email = 'eigenaar@a.nl'), 'planner joined firm A';
  assert (select accepted_at is not null from public.invitations where email = 'planner@a.nl'), 'invitation accepted';
  assert (select count(*) from public.house_styles) = 2, 'default house style per firm';
  assert not exists (select 1 from public.users where email = 'admin@plannr.test'), 'admin has no firm';
end $$;

-- Helper to impersonate a user the way PostgREST does.
create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
  set role authenticated;
end $$;
grant execute on function pg_temp.act_as(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Owner A creates a client, a plan and an asset.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

insert into public.clients (id, firm_id, first_name, last_name, company_name, created_by)
values ('10000000-0000-0000-0000-000000000001', public.current_firm_id(), 'Jan', 'Jansen', 'Jansen Holding B.V.', auth.uid());

insert into public.plans (id, firm_id, client_id, title, created_by)
values ('20000000-0000-0000-0000-000000000001', public.current_firm_id(), '10000000-0000-0000-0000-000000000001', 'Plan 2026', auth.uid());

reset role;
update public.clients set updated_at = now() - interval '1 day' where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

insert into public.assets (firm_id, plan_id, side, type, tax_box, value)
values (public.current_firm_id(), '20000000-0000-0000-0000-000000000001', 'prive', 'spaargeld', 3, 50000);

do $$
begin
  assert (select updated_at > now() - interval '1 minute' from public.clients where id = '10000000-0000-0000-0000-000000000001'),
    'asset change touches client.updated_at';
end $$;

do $$
declare n int;
begin
  assert (select not ai_extraction_enabled from public.firms), 'AI reader is off by default';
  update public.firms set ai_extraction_enabled = true, ai_extraction_changed_at = now();
  get diagnostics n = row_count;
  assert n = 1, 'owner can switch on the AI reader';
  update public.firms set ai_extraction_enabled = false;

  update public.firms set rapport_secties_standaard = array['samenvatting', 'toelichting'];
  get diagnostics n = row_count;
  assert n = 1, 'owner can set the default report sections';
end $$;

-- ---------------------------------------------------------------------------
-- Planner A sees firm A data; owner-only actions are blocked.
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');

do $$
declare n int;
begin
  assert (select count(*) from public.clients) = 1, 'planner sees firm client';
  assert (select count(*) from public.assets) = 1, 'planner sees firm assets';
  assert (select count(*) from public.users) = 2, 'planner sees firm colleagues only';

  update public.house_styles set primary_color = '#000000';
  get diagnostics n = row_count;
  assert n = 0, 'planner cannot change house style';

  update public.firms set ai_extraction_enabled = true;
  get diagnostics n = row_count;
  assert n = 0, 'planner cannot switch on the AI reader';

  update public.firms set rendement_standaard = '{"beleggingen": 9}';
  get diagnostics n = row_count;
  assert n = 0, 'planner cannot change the firm return defaults';

  update public.firms set rapport_secties_standaard = array['samenvatting'];
  get diagnostics n = row_count;
  assert n = 0, 'planner cannot change the default report sections';

  update public.plans set gearchiveerd_op = now() where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'planner can archive a plan of the own firm';
  update public.plans set gearchiveerd_op = null where id = '20000000-0000-0000-0000-000000000001';

  -- A scenario of a plan in the same firm is allowed.
  insert into public.plans (firm_id, client_id, title, scenario_van, created_by)
  values (public.current_firm_id(), '10000000-0000-0000-0000-000000000001', 'Scenario: eerder stoppen',
          '20000000-0000-0000-0000-000000000001', auth.uid());

  begin
    insert into public.invitations (firm_id, email, invited_by) values (public.current_firm_id(), 'x@a.nl', auth.uid());
    assert false, 'planner must not invite';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.users set role = 'owner' where id = auth.uid();
    assert false, 'planner must not change own role';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.touch_client('10000000-0000-0000-0000-000000000001');
    assert false, 'internal functions are not callable';
  exception when insufficient_privilege then null;
  end;

  begin
    perform * from public.admin_totals();
    assert false, 'non-admin cannot read admin stats';
  exception when insufficient_privilege then null;
  end;

  begin
    perform * from public.activity_log;
    assert false, 'activity log not directly readable';
  exception when insufficient_privilege then null;
  end;

  delete from public.clients;
  get diagnostics n = row_count;
  assert n = 0, 'planner cannot delete clients';
end $$;

-- ---------------------------------------------------------------------------
-- Owner B sees nothing of firm A and cannot write into it.
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');

do $$
declare n int;
begin
  assert (select count(*) from public.clients) = 0, 'firm B sees no firm A clients';
  assert (select count(*) from public.plans) = 0, 'firm B sees no firm A plans';
  assert (select count(*) from public.assets) = 0, 'firm B sees no firm A assets';
  assert (select count(*) from public.users) = 1, 'firm B sees only itself';
  assert (select count(*) from public.firms) = 1, 'firm B sees only own firm';

  update public.plans set gearchiveerd_op = now() where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'firm B cannot archive a firm A plan';

  -- A scenario cannot point at another firm's plan.
  begin
    insert into public.clients (id, firm_id, first_name, last_name, created_by)
    values ('10000000-0000-0000-0000-0000000000b1', public.current_firm_id(), 'Bea', 'B', auth.uid());
    insert into public.plans (firm_id, client_id, title, scenario_van, created_by)
    values (public.current_firm_id(), '10000000-0000-0000-0000-0000000000b1', 'Stiekem', '20000000-0000-0000-0000-000000000001', auth.uid());
    assert false, 'scenario must not reference another firm''s plan';
  exception when foreign_key_violation then null;
  end;

  -- Composite FK: a firm B note cannot point at a firm A client.
  begin
    insert into public.client_notes (firm_id, client_id, author_id, content)
    values (public.current_firm_id(), '10000000-0000-0000-0000-000000000001', auth.uid(), 'inbraak');
    assert false, 'cross-firm note must fail';
  exception when foreign_key_violation then null;
  end;

  update public.clients set first_name = 'Hacked';
  get diagnostics n = row_count;
  assert n = 0, 'firm B cannot update firm A clients';
end $$;

-- Explicitly try writing with firm A's id while logged in as B.
reset role;
create temp table firm_a as select firm_id from public.users where email = 'eigenaar@a.nl';
grant select on firm_a to authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$
begin
  begin
    insert into public.clients (firm_id, first_name, last_name, created_by)
    values ((select firm_id from firm_a), 'X', 'Y', auth.uid());
    assert false, 'insert into other firm must fail';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Storage policies.
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
do $$
begin
  insert into storage.objects (bucket_id, name) values ('documents', public.current_firm_id() || '/plan/ib.pdf');

  begin
    insert into storage.objects (bucket_id, name) values ('documents', (select firm_id from firm_a)::text || 'x/plan/ib.pdf');
    assert false, 'upload outside own folder must fail';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects (bucket_id, name) values ('logos', public.current_firm_id() || '/logo.png');
    assert false, 'planner must not upload logo';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$
begin
  assert (select count(*) from storage.objects) = 0, 'firm B cannot see firm A files';
end $$;

-- ---------------------------------------------------------------------------
-- Super admin: counts only, and no access to client tables.
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000ad');
do $$
begin
  assert (select firms from public.admin_totals()) = 2, 'admin sees firm count';
  assert (select clients from public.admin_totals()) = 1, 'admin sees client count';
  assert (select count(*) from public.admin_firm_stats()) = 2, 'admin sees per-firm stats';
  assert (select count(*) from public.admin_monthly_stats(6)) = 6, 'admin monthly series';
  assert (select count(*) from public.clients) = 0, 'admin cannot read client rows';
  assert (select count(*) from public.assets) = 0, 'admin cannot read asset rows';
end $$;

-- ---------------------------------------------------------------------------
-- Existing account without a firm accepts an invitation at login.
-- ---------------------------------------------------------------------------
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a3', 'later@a.nl', '{"name":"Later"}');
insert into public.invitations (firm_id, email, invited_by)
select firm_id, 'later@a.nl', id from public.users where email = 'eigenaar@a.nl';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
select public.record_login();
do $$
begin
  assert public.current_firm_id() is not null, 'invitation accepted at login';
  assert (select role from public.users where id = auth.uid()) = 'planner', 'joined as planner';
end $$;

reset role;
\o
\echo 'ALL RLS TESTS PASSED'
