-- One-day jobs marketplace: core schema.
--
-- Anti-bypass principles enforced here:
--   * Contact details (phone, payment ids) live in private_profiles, readable only by their owner.
--   * The exact shift address lives in shift_locations, readable only by the employer and booked workers.
--   * Chat messages can only be written by the send-message edge function, which masks contact info.
--   * Bookings, money and strikes are only changed by security-definer functions and edge functions.

create extension if not exists pgcrypto;

create type public.user_role as enum ('worker', 'employer', 'admin');
create type public.id_status as enum ('pending', 'approved', 'rejected');
create type public.shift_status as enum ('open', 'filled', 'completed', 'cancelled');
create type public.booking_status as enum (
  'pending_payment',       -- claimed, employer card not yet charged
  'claimed',               -- paid into escrow, waiting for the shift
  'checked_in',
  'checked_out',
  'confirmed',             -- hours confirmed (by employer or automatically), awaiting payout
  'paid',                  -- worker paid out
  'no_show',
  'cancelled_by_worker',
  'cancelled_by_employer',
  'disputed'
);

-- Free text shown to the other side (bios, shift descriptions) can't carry
-- contact details. Chat is masked more thoroughly by the send-message function.
create function public.no_contact_info(t text) returns boolean
language sql immutable as $$
  select t is null or (
    t !~ '\d[\d\s().-]{5,}\d'
    and t !~* '(@|https?://|www\.|whats\s*app|telegram|viber|insta|facebook|snapchat|ვ[ოა][ცტთ]?ს?აპ|ტელეგრამ|ვაიბერ|ინსტაგრამ|ფეისბუქ|ват[сc]ап|телеграм|вайбер)'
  );
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role public.user_role not null,
  full_name text not null check (length(full_name) between 1 and 80),
  photo_url text,
  -- Free text is shown to the other side, so it can't carry contact details.
  -- (Chat is masked more thoroughly by the send-message function.)
  bio text check (length(bio) <= 500 and public.no_contact_info(bio)),
  skills text[] not null default '{}',
  languages text[] not null default '{}',
  areas text[] not null default '{}',
  id_status public.id_status not null default 'pending',
  rating_avg numeric(3, 2),
  rating_count int not null default 0,
  shifts_completed int not null default 0,
  strikes int not null default 0,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

-- Never readable by other users.
create table public.private_profiles (
  id uuid primary key references public.profiles on delete cascade,
  phone text,
  id_document_path text,
  selfie_path text,
  -- Employers: saved card at the payment provider (Payze). Set by the payment webhook.
  card_token text,
  card_mask text,
  has_payment_method boolean not null default false,
  -- Workers: Georgian bank account for payouts.
  payout_iban text check (payout_iban ~ '^GE[0-9]{2}[A-Z]{2}[0-9]{16}$'),
  payouts_enabled boolean generated always as (payout_iban is not null) stored,
  expo_push_token text
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles on delete cascade,
  name text not null check (length(name) between 1 and 120),
  legal_id text,
  contact_person text,
  billing_address text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Shifts and bookings
-- ---------------------------------------------------------------------------

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles on delete cascade,
  business_id uuid not null references public.businesses on delete cascade,
  role_title text not null check (length(role_title) between 1 and 80),
  category text not null,
  description text check (length(description) <= 2000 and public.no_contact_info(description)),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  workers_needed int not null check (workers_needed between 1 and 50),
  hourly_rate_cents int not null check (hourly_rate_cents > 0),
  currency text not null default 'gel',
  area text not null,             -- public: neighbourhood / district only
  status public.shift_status not null default 'open',
  is_urgent boolean not null default false,
  favorites_only_until timestamptz,  -- rebook: favorites see it first
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '16 hours')
);
create index shifts_open_idx on public.shifts (starts_at) where status = 'open';
create index shifts_employer_idx on public.shifts (employer_id, starts_at desc);

-- Revealed only to the employer and workers with an active booking.
create table public.shift_locations (
  shift_id uuid primary key references public.shifts on delete cascade,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  instructions text check (length(instructions) <= 2000)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts on delete cascade,
  worker_id uuid not null references public.profiles on delete cascade,
  status public.booking_status not null default 'pending_payment',
  is_repeat boolean not null default false,
  fee_bps int,
  wage_cents int,
  fee_cents int,
  payment_id text,               -- provider payment id of the employer charge
  payout_ref text,               -- bank transfer reference once the worker is paid
  settled_at timestamptz,        -- unworked hours refunded, payout_cents final
  refund_cents int not null default 0,
  payout_cents int,
  check_in_at timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  check_out_at timestamptz,
  confirmed_minutes int,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  reminded_day_before boolean not null default false,
  reminded_two_hours boolean not null default false,
  created_at timestamptz not null default now(),
  unique (shift_id, worker_id)
);
create index bookings_worker_idx on public.bookings (worker_id, created_at desc);
create index bookings_status_idx on public.bookings (status);

create table public.messages (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings on delete cascade,
  sender_id uuid not null references public.profiles on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  was_masked boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_booking_idx on public.messages (booking_id, created_at);

create table public.ratings (
  booking_id uuid not null references public.bookings on delete cascade,
  rater_id uuid not null references public.profiles on delete cascade,
  ratee_id uuid not null references public.profiles on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text check (length(comment) <= 500),
  created_at timestamptz not null default now(),
  primary key (booking_id, rater_id)
);

create table public.favorites (
  employer_id uuid not null references public.profiles on delete cascade,
  worker_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (employer_id, worker_id)
);

create table public.strikes (
  id bigint generated always as identity primary key,
  worker_id uuid not null references public.profiles on delete cascade,
  booking_id uuid references public.bookings on delete set null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- Card-saving sessions started with the payment provider, so the webhook can
-- tell whose card was saved.
create table public.card_setups (
  payment_id text primary key,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

-- Contact-sharing attempts and other bypass signals, for the admin panel.
create table public.bypass_flags (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  booking_id uuid references public.bookings on delete set null,
  reasons text[] not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create function public.active_booking_statuses() returns public.booking_status[]
language sql immutable as $$
  select array['claimed', 'checked_in', 'checked_out', 'confirmed', 'paid']::public.booking_status[];
$$;

create function public.has_active_booking(p_shift_id uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings
    where shift_id = p_shift_id and worker_id = p_user
      and status = any (active_booking_statuses())
  );
$$;

create function public.is_booking_party(p_booking_id uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings b join shifts s on s.id = b.shift_id
    where b.id = p_booking_id and (b.worker_id = p_user or s.employer_id = p_user)
  );
$$;

create function public.is_favorite(p_employer uuid, p_worker uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from favorites where employer_id = p_employer and worker_id = p_worker);
$$;

-- Distance in metres (haversine).
create function public.distance_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns float8
language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Keeps shifts.status in step with the number of active bookings.
create function public.sync_shift_status(p_shift_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_needed int;
  v_status shift_status;
  v_active int;
begin
  select workers_needed, status into v_needed, v_status from shifts where id = p_shift_id for update;
  if v_status in ('cancelled', 'completed') then
    return;
  end if;
  select count(*) into v_active from bookings
    where shift_id = p_shift_id and status = any (active_booking_statuses() || 'pending_payment'::booking_status);
  update shifts set status = case when v_active >= v_needed then 'filled' else 'open' end::shift_status
    where id = p_shift_id;
end;
$$;

create function public.bookings_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform sync_shift_status(coalesce(new.shift_id, old.shift_id));
  return null;
end;
$$;

create trigger bookings_sync_shift
after insert or update of status or delete on public.bookings
for each row execute function public.bookings_after_change();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.private_profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_locations enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;
alter table public.ratings enable row level security;
alter table public.favorites enable row level security;
alter table public.strikes enable row level security;
alter table public.bypass_flags enable row level security;
alter table public.card_setups enable row level security;

-- Column-level grants stop users from editing ratings, strikes, roles or payment state.
revoke all on all tables in schema public from anon, authenticated;

-- profiles: public card (no contact info lives here)
grant select on public.profiles to authenticated;
grant insert (id, role, full_name, photo_url, bio, skills, languages, areas) on public.profiles to authenticated;
grant update (full_name, photo_url, bio, skills, languages, areas) on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (id = auth.uid() and role in ('worker', 'employer'));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- private_profiles: owner only
grant select on public.private_profiles to authenticated;
grant insert (id, phone, id_document_path, selfie_path, expo_push_token, payout_iban) on public.private_profiles to authenticated;
grant update (phone, id_document_path, selfie_path, expo_push_token, payout_iban) on public.private_profiles to authenticated;
create policy private_self_read on public.private_profiles for select to authenticated
  using (id = auth.uid() or is_admin());
create policy private_self_insert on public.private_profiles for insert to authenticated
  with check (id = auth.uid());
create policy private_self_update on public.private_profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- businesses
grant select on public.businesses to authenticated;
grant insert (owner_id, name, legal_id, contact_person, billing_address) on public.businesses to authenticated;
grant update (name, legal_id, contact_person, billing_address) on public.businesses to authenticated;
create policy businesses_read on public.businesses for select to authenticated using (true);
create policy businesses_insert_own on public.businesses for insert to authenticated
  with check (owner_id = auth.uid()
    and exists (select 1 from profiles where id = auth.uid() and role = 'employer'));
create policy businesses_update_own on public.businesses for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- shifts: open shifts are public to workers (favorites first while the rebook window is open)
grant select on public.shifts to authenticated;
grant insert (employer_id, business_id, role_title, category, description, starts_at, ends_at,
  workers_needed, hourly_rate_cents, currency, area, favorites_only_until)
  on public.shifts to authenticated;
create policy shifts_read on public.shifts for select to authenticated using (
  employer_id = auth.uid()
  or has_active_booking(id, auth.uid())
  or is_admin()
  or (status = 'open' and starts_at > now()
      and (favorites_only_until is null or favorites_only_until < now()
           or is_favorite(employer_id, auth.uid())))
);
create policy shifts_insert_own on public.shifts for insert to authenticated with check (
  employer_id = auth.uid()
  and starts_at > now()
  and exists (select 1 from businesses where id = business_id and owner_id = auth.uid())
  and exists (select 1 from profiles where id = auth.uid() and role = 'employer' and not suspended)
);

-- shift_locations: exact address only after a paid booking
grant select on public.shift_locations to authenticated;
grant insert (shift_id, address, lat, lng, instructions) on public.shift_locations to authenticated;
create policy locations_read on public.shift_locations for select to authenticated using (
  exists (select 1 from shifts where id = shift_id and employer_id = auth.uid())
  or has_active_booking(shift_id, auth.uid())
  or is_admin()
);
create policy locations_insert_own on public.shift_locations for insert to authenticated with check (
  exists (select 1 from shifts where id = shift_id and employer_id = auth.uid())
);

-- bookings: parties can read; all writes go through functions
grant select on public.bookings to authenticated;
create policy bookings_read on public.bookings for select to authenticated using (
  worker_id = auth.uid()
  or exists (select 1 from shifts where id = shift_id and employer_id = auth.uid())
  or is_admin()
);

-- messages: parties can read; only the send-message function (service role) writes
grant select on public.messages to authenticated;
create policy messages_read on public.messages for select to authenticated using (
  is_booking_party(booking_id, auth.uid()) or is_admin()
);

-- ratings: public (they build reputation); written via rate_booking()
grant select on public.ratings to authenticated;
create policy ratings_read on public.ratings for select to authenticated using (true);

-- favorites: employer manages own list
grant select, insert, delete on public.favorites to authenticated;
create policy favorites_own on public.favorites for all to authenticated
  using (employer_id = auth.uid()) with check (employer_id = auth.uid());

-- strikes: worker sees own
grant select on public.strikes to authenticated;
create policy strikes_read on public.strikes for select to authenticated
  using (worker_id = auth.uid() or is_admin());

-- bypass_flags: admins only
grant select on public.bypass_flags to authenticated;
create policy flags_admin on public.bypass_flags for select to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- Actions (called from the app via rpc, or from edge functions)
-- ---------------------------------------------------------------------------

-- Reserves a slot for a worker. Called by the claim-shift edge function, which
-- then charges the employer and moves the booking to 'claimed'.
create function public.reserve_shift(p_shift_id uuid, p_worker_id uuid)
returns table (booking_id uuid, is_repeat boolean)
language plpgsql security definer set search_path = public as $$
declare
  s shifts%rowtype;
  w profiles%rowtype;
  v_active int;
  v_repeat boolean;
  v_booking uuid;
begin
  select * into w from profiles where id = p_worker_id;
  if w.role is distinct from 'worker' then raise exception 'only workers can claim shifts'; end if;
  if w.suspended then raise exception 'account suspended'; end if;
  if w.id_status <> 'approved' then raise exception 'ID verification pending'; end if;

  select * into s from shifts where id = p_shift_id for update;
  if not found or s.status <> 'open' or s.starts_at <= now() then
    raise exception 'shift is not open';
  end if;
  if s.favorites_only_until > now() and not is_favorite(s.employer_id, p_worker_id) then
    raise exception 'shift is reserved for favorite workers for now';
  end if;

  select count(*) into v_active from bookings
    where shift_id = p_shift_id and status = any (active_booking_statuses() || 'pending_payment'::booking_status);
  if v_active >= s.workers_needed then raise exception 'shift is full'; end if;

  if exists (
    select 1 from bookings b join shifts o on o.id = b.shift_id
    where b.worker_id = p_worker_id and b.status = any (active_booking_statuses() || 'pending_payment'::booking_status)
      and o.status <> 'cancelled'
      and tstzrange(o.starts_at, o.ends_at) && tstzrange(s.starts_at, s.ends_at)
  ) then
    raise exception 'you already have a shift at that time';
  end if;

  v_repeat := is_favorite(s.employer_id, p_worker_id) or exists (
    select 1 from bookings b join shifts o on o.id = b.shift_id
    where b.worker_id = p_worker_id and o.employer_id = s.employer_id and b.status in ('confirmed', 'paid')
  );

  -- A previously cancelled booking for the same shift is reused.
  insert into bookings (shift_id, worker_id, status, is_repeat)
    values (p_shift_id, p_worker_id, 'pending_payment', v_repeat)
    on conflict (shift_id, worker_id) do update
      set status = 'pending_payment', is_repeat = excluded.is_repeat, cancelled_at = null,
          payment_id = null, payout_ref = null, settled_at = null, refund_cents = 0, payout_cents = null
      where bookings.status in ('cancelled_by_worker', 'cancelled_by_employer')
    returning id into v_booking;
  if v_booking is null then raise exception 'you already claimed this shift'; end if;

  return query select v_booking, v_repeat;
end;
$$;

create function public.check_in(p_booking_id uuid, p_lat float8, p_lng float8) returns void
language plpgsql security definer set search_path = public as $$
declare
  b bookings%rowtype;
  s shifts%rowtype;
  l shift_locations%rowtype;
  v_dist float8;
begin
  select * into b from bookings where id = p_booking_id and worker_id = auth.uid() for update;
  if not found then raise exception 'booking not found'; end if;
  if b.status <> 'claimed' then raise exception 'cannot check in from status %', b.status; end if;
  select * into s from shifts where id = b.shift_id;
  select * into l from shift_locations where shift_id = b.shift_id;
  if now() < s.starts_at - interval '30 minutes' then raise exception 'check-in opens 30 minutes before the shift'; end if;
  if now() > s.ends_at then raise exception 'shift has ended'; end if;
  v_dist := distance_m(p_lat, p_lng, l.lat, l.lng);
  if v_dist > 300 then raise exception 'you are % m from the job site; check in when you arrive', round(v_dist); end if;
  update bookings set status = 'checked_in', check_in_at = now(), check_in_lat = p_lat, check_in_lng = p_lng
    where id = p_booking_id;
end;
$$;

create function public.check_out(p_booking_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update bookings set status = 'checked_out', check_out_at = now()
    where id = p_booking_id and worker_id = auth.uid() and status = 'checked_in';
  if not found then raise exception 'not checked in'; end if;
end;
$$;

-- Minutes paid: from the later of check-in and shift start, to the earlier of check-out and shift end.
create function public.worked_minutes(p_booking_id uuid) returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, round(extract(epoch from (
    least(coalesce(b.check_out_at, s.ends_at), s.ends_at) - greatest(b.check_in_at, s.starts_at)
  )) / 60))::int
  from bookings b join shifts s on s.id = b.shift_id
  where b.id = p_booking_id;
$$;

-- Employer confirms (optionally adjusts) hours. Payout is released by the shift-cron function.
create function public.confirm_hours(p_booking_id uuid, p_minutes int default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ok boolean;
begin
  select exists (
    select 1 from bookings b join shifts s on s.id = b.shift_id
    where b.id = p_booking_id and s.employer_id = auth.uid() and b.status in ('checked_in', 'checked_out')
  ) into v_ok;
  if not v_ok then raise exception 'nothing to confirm'; end if;
  update bookings
    set status = 'confirmed',
        check_out_at = coalesce(check_out_at, now()),
        confirmed_minutes = coalesce(p_minutes, worked_minutes(p_booking_id)),
        confirmed_at = now()
    where id = p_booking_id;
end;
$$;

-- Service-role only: confirm hours nobody disputed within 24h, and close shifts
-- where the worker forgot to check out.
create function public.auto_confirm_hours() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  update bookings b set check_out_at = s.ends_at, status = 'checked_out'
    from shifts s
    where s.id = b.shift_id and b.status = 'checked_in' and s.ends_at < now() - interval '2 hours';

  with due as (
    select id from bookings where status = 'checked_out' and check_out_at < now() - interval '24 hours'
  )
  update bookings b
    set status = 'confirmed', confirmed_minutes = worked_minutes(b.id), confirmed_at = now()
    from due where b.id = due.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Service-role only: gives a strike and suspends at 3.
create function public.add_strike(p_worker_id uuid, p_booking_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into strikes (worker_id, booking_id, reason) values (p_worker_id, p_booking_id, p_reason);
  update profiles set strikes = strikes + 1, suspended = suspended or strikes + 1 >= 3
    where id = p_worker_id;
end;
$$;

-- Service-role only: bookings 15 minutes past start with no check-in.
-- Marks them no-show, strikes the worker, and reopens the shift as urgent.
create function public.mark_no_shows()
returns table (booking_id uuid, shift_id uuid, employer_id uuid, worker_id uuid, payment_id text,
               wage_cents int, fee_cents int)
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in
    select b.id, b.shift_id, s.employer_id, b.worker_id, b.payment_id, b.wage_cents, b.fee_cents
    from bookings b join shifts s on s.id = b.shift_id
    where b.status = 'claimed' and s.starts_at < now() - interval '15 minutes' and s.ends_at > now()
    for update of b
  loop
    update bookings set status = 'no_show' where id = r.id;
    perform add_strike(r.worker_id, r.id, 'no-show');
    update shifts set is_urgent = true where id = r.shift_id;
    booking_id := r.id; shift_id := r.shift_id; employer_id := r.employer_id; worker_id := r.worker_id;
    payment_id := r.payment_id; wage_cents := r.wage_cents; fee_cents := r.fee_cents;
    return next;
  end loop;
end;
$$;

-- Service-role only: shifts whose bookings are all settled become completed.
create function public.complete_finished_shifts() returns void
language sql security definer set search_path = public as $$
  update shifts s set status = 'completed'
  where s.status in ('open', 'filled') and s.ends_at < now()
    and not exists (
      select 1 from bookings b where b.shift_id = s.id
        and b.status in ('pending_payment', 'claimed', 'checked_in', 'checked_out')
    );
$$;

create function public.rate_booking(p_booking_id uuid, p_stars int, p_comment text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  b bookings%rowtype;
  v_employer uuid;
  v_ratee uuid;
begin
  select * into b from bookings where id = p_booking_id;
  select employer_id into v_employer from shifts where id = b.shift_id;
  if auth.uid() = b.worker_id then v_ratee := v_employer;
  elsif auth.uid() = v_employer then v_ratee := b.worker_id;
  else raise exception 'not your booking';
  end if;
  if b.status not in ('checked_out', 'confirmed', 'paid') then raise exception 'rate after the shift'; end if;

  insert into ratings (booking_id, rater_id, ratee_id, stars, comment)
    values (p_booking_id, auth.uid(), v_ratee, p_stars, p_comment);
  update profiles p set
    rating_count = agg.n,
    rating_avg = agg.avg
  from (select count(*) n, round(avg(stars), 2) avg from ratings where ratee_id = v_ratee) agg
  where p.id = v_ratee;
end;
$$;

-- Employer withdraws a shift. Booked workers must be cancelled first (through
-- the cancel-booking function, which handles refunds and late-cancellation pay).
create function public.cancel_shift(p_shift_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from bookings where shift_id = p_shift_id
      and status in ('pending_payment', 'claimed', 'checked_in', 'checked_out', 'confirmed')
  ) then
    raise exception 'cancel the booked workers first';
  end if;
  update shifts set status = 'cancelled'
    where id = p_shift_id and employer_id = auth.uid() and status in ('open', 'filled');
  if not found then raise exception 'shift not found'; end if;
end;
$$;

-- Service-role functions must not be callable from the app.
revoke execute on function public.reserve_shift(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.auto_confirm_hours() from public, anon, authenticated;
revoke execute on function public.add_strike(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.mark_no_shows() from public, anon, authenticated;
revoke execute on function public.complete_finished_shifts() from public, anon, authenticated;
revoke execute on function public.sync_shift_status(uuid) from public, anon, authenticated;

-- Realtime chat
alter publication supabase_realtime add table public.messages;

-- ---------------------------------------------------------------------------
-- Admin actions (for the admin panel; Supabase Studio works as a first admin UI)
-- ---------------------------------------------------------------------------

create function public.admin_set_id_status(p_user uuid, p_status public.id_status) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only'; end if;
  update profiles set id_status = p_status where id = p_user;
end;
$$;

-- Worker payouts are bank transfers from the company account. Admins send them
-- from the payout list and record the transfer reference here.
create function public.admin_mark_paid(p_booking_id uuid, p_reference text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_worker uuid;
  v_status booking_status;
begin
  if not is_admin() then raise exception 'admins only'; end if;
  update bookings set payout_ref = coalesce(nullif(p_reference, ''), 'sent'),
                      status = case when status = 'confirmed' then 'paid'::booking_status else status end
    where id = p_booking_id and settled_at is not null and payout_ref is null and payout_cents > 0
    returning worker_id, status into v_worker, v_status;
  if not found then raise exception 'nothing to pay for this booking'; end if;
  if v_status = 'paid' then
    update profiles set shifts_completed = shifts_completed + 1 where id = v_worker;
  end if;
end;
$$;

create function public.admin_set_suspended(p_user uuid, p_suspended boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only'; end if;
  update profiles set suspended = p_suspended where id = p_user;
end;
$$;
