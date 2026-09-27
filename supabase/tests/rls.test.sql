-- Checks the anti-bypass rules and the booking lifecycle. Any failed assert aborts.
\set ON_ERROR_STOP 1
grant all on all tables in schema public to service_role;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000e'), -- employer
  ('00000000-0000-0000-0000-00000000000a'), -- worker A
  ('00000000-0000-0000-0000-00000000000b'); -- worker B

create function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p::text, false);
$$;

-- Sign-up as each user
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
insert into profiles (id, role, full_name) values (auth.uid(), 'employer', 'Cafe Owner');
insert into private_profiles (id, phone) values (auth.uid(), '+15550000001');
insert into businesses (owner_id, name) values (auth.uid(), 'Test Cafe');
insert into shifts (employer_id, business_id, role_title, category, starts_at, ends_at, workers_needed, hourly_rate_cents, area)
  select auth.uid(), id, 'Waiter', 'hospitality', now() + interval '1 hour', now() + interval '9 hours', 1, 1500, 'Old Town'
  from businesses;
insert into shift_locations (shift_id, address, lat, lng) select id, '1 Main St', 41.7, 44.8 from shifts;

-- An employer cannot promote themselves or clear strikes
do $$ begin
  begin update profiles set role = 'admin' where id = auth.uid(); raise exception 'FAIL: role editable';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into profiles (id, role, full_name) values (auth.uid(), 'worker', 'Worker A');
insert into private_profiles (id, phone) values (auth.uid(), '+15550000002');
do $$ begin
  begin insert into profiles (id, role, full_name) values ('00000000-0000-0000-0000-00000000000b', 'admin', 'x');
    raise exception 'FAIL: could create profile for someone else';
  exception when insufficient_privilege then null; end;
end $$;

-- Worker can see the open shift but not the address or the employer's phone
do $$ begin
  assert (select count(*) from shifts) = 1, 'worker should see the open shift';
  assert (select count(*) from shift_locations) = 0, 'address must be hidden before booking';
  assert (select count(*) from private_profiles) = 1, 'only own private profile visible';
end $$;
do $$ begin
  begin insert into messages (booking_id, sender_id, body) values (gen_random_uuid(), auth.uid(), 'hi');
    raise exception 'FAIL: direct message insert allowed';
  exception when insufficient_privilege then null; end;
  begin perform reserve_shift((select id from shifts), auth.uid()); raise exception 'FAIL: reserve callable by app';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into profiles (id, role, full_name) values (auth.uid(), 'worker', 'Worker B');

-- Service role: approve IDs and reserve for worker A (as the claim-shift function does)
reset role;
update profiles set id_status = 'approved' where role = 'worker';
select * from reserve_shift((select id from shifts), '00000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select status from shifts) = 'filled', 'shift should be filled';
  begin perform reserve_shift((select id from shifts), '00000000-0000-0000-0000-00000000000b');
    raise exception 'FAIL: overbooked';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
update bookings set status = 'claimed', wage_cents = 12000, fee_cents = 3000;

-- Worker A now sees the address; worker B does not
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin assert (select count(*) from shift_locations) = 1, 'booked worker should see address'; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from shift_locations) = 0, 'other worker must not see address';
  assert (select count(*) from bookings) = 0, 'other worker must not see bookings';
  assert (select count(*) from shifts) = 0, 'filled shift hidden from others';
end $$;

-- Check-in too far away fails, at the site works
reset role;
update shifts set starts_at = now() + interval '10 minutes';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  begin perform check_in((select id from bookings), 41.8, 44.8); raise exception 'FAIL: far check-in allowed';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;
select check_in((select id from bookings), 41.7005, 44.8);
select check_out((select id from bookings));

-- Employer confirms hours and both rate each other
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select confirm_hours((select id from bookings), 480);
select rate_booking((select id from bookings), 5, 'great');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select rate_booking((select id from bookings), 4);
reset role;
do $$ begin
  assert (select status from bookings) = 'confirmed';
  assert (select confirmed_minutes from bookings) = 480;
  assert (select rating_avg from profiles where full_name = 'Worker A') = 5.00;
  assert (select rating_avg from profiles where full_name = 'Cafe Owner') = 4.00;
end $$;

-- Strikes: three suspends
select add_strike('00000000-0000-0000-0000-00000000000b', null, 'x') from generate_series(1, 3);
do $$ begin assert (select suspended from profiles where full_name = 'Worker B'), 'three strikes suspends'; end $$;

-- No-show: claimed booking 20 minutes after start
insert into shifts (id, employer_id, business_id, role_title, category, starts_at, ends_at, workers_needed, hourly_rate_cents, area)
  select 'aaaaaaaa-0000-0000-0000-000000000001', owner_id, id, 'Mover', 'moving', now() - interval '20 minutes', now() + interval '4 hours', 1, 1500, 'Center'
  from businesses;
insert into bookings (shift_id, worker_id, status) values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'claimed');
select count(*) as no_shows from mark_no_shows();
do $$ begin
  assert (select status from bookings where shift_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'no_show';
  assert (select strikes from profiles where full_name = 'Worker A') = 1;
  assert (select status = 'open' and is_urgent from shifts where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'shift reopened as urgent';
end $$;

\echo ALL RLS TESTS PASSED
