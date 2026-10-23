-- Access-rule tests for ILI's Supabase tables. Run against a development project only:
--   supabase db query --linked -f supabase/tests/access_rules_test.sql
-- Everything runs inside one transaction and is rolled back, including the two temporary customers.
begin;

create temp table r (n serial, test text, expected text, actual text);
grant all on r to authenticated, anon;
grant usage on sequence r_n_seq to authenticated, anon;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rls-test-a@example.invalid', '{}', '{}', now(), now()),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rls-test-b@example.invalid', '{}', '{}', now(), now());

-- A download for A, written the way the Edge Function does it (as the table owner)
insert into public.pattern_downloads (user_id, pattern_id, seamscape_pattern_id, seamscape_version, paper, measurements_cm, variables_in)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aline-silk-dress', 'df297df0-db1d-4193-84e8-d634c373ee6b', 1, 'A4', '{}', '{}');

-- ===================== Customer A =====================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into public.measurements (user_id, chest_girth, waist_girth, hip_girth, shoulder_width)
values ('aaaaaaaa-0000-4000-8000-000000000001', 91.44, 73.66, 101.6, 37.465);
insert into r (test, expected, actual) select 'A saves and reads own measurements', '1', count(*)::text from public.measurements;
insert into r (test, expected, actual) select 'A sees own download history', '1', count(*)::text from public.pattern_downloads;

do $$ begin
  insert into public.pattern_downloads (user_id, pattern_id, seamscape_pattern_id, seamscape_version, paper, measurements_cm, variables_in)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'aline-silk-dress', 'df297df0-db1d-4193-84e8-d634c373ee6b', 1, 'A4', '{}', '{}');
  insert into r (test, expected, actual) values ('A writes download history directly', 'blocked', 'ALLOWED');
exception when others then
  insert into r (test, expected, actual) values ('A writes download history directly', 'blocked', 'blocked (' || sqlstate || ')');
end $$;

do $$ declare n int; begin
  delete from public.pattern_downloads;
  get diagnostics n = row_count;
  insert into r (test, expected, actual) values ('A deletes own download history', 'blocked or 0 rows', n || ' rows');
exception when others then
  insert into r (test, expected, actual) values ('A deletes own download history', 'blocked or 0 rows', 'blocked (' || sqlstate || ')');
end $$;

do $$ declare n int; begin
  select count(*) into n from public.pattern_sources;
  insert into r (test, expected, actual) values ('A reads SeamScape links / measurement mapping', 'blocked', 'ALLOWED (' || n || ')');
exception when others then
  insert into r (test, expected, actual) values ('A reads SeamScape links / measurement mapping', 'blocked', 'blocked (' || sqlstate || ')');
end $$;

-- ===================== Customer B =====================
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into r (test, expected, actual) select 'B sees A''s measurements', '0', count(*)::text from public.measurements;
insert into r (test, expected, actual) select 'B sees A''s download history', '0', count(*)::text from public.pattern_downloads;

do $$ declare n int; begin
  update public.measurements set chest_girth = 1 where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  insert into r (test, expected, actual) values ('B edits A''s measurements', '0 rows changed', n || ' rows changed');
end $$;

do $$ begin
  insert into public.measurements (user_id, chest_girth) values ('aaaaaaaa-0000-4000-8000-000000000001', 1);
  insert into r (test, expected, actual) values ('B writes measurements into A''s account', 'blocked', 'ALLOWED');
exception when others then
  insert into r (test, expected, actual) values ('B writes measurements into A''s account', 'blocked', 'blocked (' || sqlstate || ')');
end $$;

-- ===================== Signed-out visitor =====================
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$ declare t text; n int; begin
  foreach t in array array['measurements', 'user_patterns', 'pattern_downloads', 'pattern_sources'] loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      insert into r (test, expected, actual) values ('Signed-out visitor reads ' || t, '0 rows or blocked', n || ' rows');
    exception when others then
      insert into r (test, expected, actual) values ('Signed-out visitor reads ' || t, '0 rows or blocked', 'blocked (' || sqlstate || ')');
    end;
  end loop;
end $$;

-- ===================== Account deletion =====================
reset role;
delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001';
insert into r (test, expected, actual)
select 'Deleting account A removes its measurements and history', '0, 0',
       (select count(*) from public.measurements where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')::text || ', ' ||
       (select count(*) from public.pattern_downloads where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')::text;

select n, test, expected, actual from r order by n;
rollback;
