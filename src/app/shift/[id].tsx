import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { RateCard } from '@/components/rate';
import { Badge, Button, Card, ErrorText, Field, Loading, Row, Screen, T } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { formatMoney, formatRating, formatShiftTime, hoursBetween } from '@/lib/format';
import { useSession } from '@/lib/session';
import { callFunction, rpc, supabase } from '@/lib/supabase';
import { BOOKING_LABELS, type Booking, type Shift, type ShiftLocation } from '@/lib/types';
import { unwrap, useQuery } from '@/lib/use-query';

import { shiftMinutes, wageCents } from '@shared/pricing';

export default function ShiftScreen() {
  const { profile } = useSession();
  return profile?.role === 'employer' ? <EmployerShift /> : <WorkerShift />;
}

function WorkerShift() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useQuery(async () => {
    const shift = unwrap(
      await supabase
        .from('shifts')
        .select('*, businesses(name), employer:profiles!shifts_employer_id_fkey(rating_avg, rating_count)')
        .eq('id', id)
        .maybeSingle(),
    ) as Shift | null;
    const booking = unwrap(
      await supabase.from('bookings').select('id, status').eq('shift_id', id).eq('worker_id', profile!.id).maybeSingle(),
    ) as Pick<Booking, 'id' | 'status'> | null;
    return { shift, booking };
  }, [id]);

  if (!data) return <Loading />;
  const { shift, booking } = data;
  if (!shift) {
    return (
      <Screen>
        <T>This shift is no longer available.</T>
      </Screen>
    );
  }

  const pay = wageCents(shift.hourly_rate_cents, shiftMinutes(shift.starts_at, shift.ends_at));
  const currency = shift.currency.toUpperCase();
  const blocked =
    profile!.suspended
      ? 'Your account is suspended.'
      : profile!.id_status !== 'approved'
        ? 'You can claim shifts once your ID is verified.'
        : null;
  const activeBooking = booking && ['claimed', 'checked_in', 'checked_out', 'confirmed', 'paid'].includes(booking.status);

  async function claim() {
    const ok = await confirm(
      'Claim this shift?',
      'Cancelling less than 24 hours before the start counts as a strike. 3 strikes suspend your account.',
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await callFunction<{ booking_id: string }>('claim-shift', { shift_id: shift!.id });
      router.replace(`/booking/${res.booking_id}`);
    } catch (e) {
      setError((e as Error).message);
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <T variant="title">{shift.role_title}</T>
      <T muted>{formatShiftTime(shift.starts_at, shift.ends_at)}</T>
      <Row>
        {shift.is_urgent ? <Badge text="Urgent" tone="warning" /> : null}
        <Badge text={shift.category} />
      </Row>
      <Card>
        <T variant="label" muted>
          You earn
        </T>
        <T variant="title">{formatMoney(pay, currency)}</T>
        <T muted>
          {formatMoney(shift.hourly_rate_cents, currency)}/h × {hoursBetween(shift.starts_at, shift.ends_at).toFixed(1)}h. Paid to your
          bank the day after the shift. No fees for you.
        </T>
      </Card>
      <Card>
        <T variant="heading">{shift.businesses?.name}</T>
        <T muted>
          {shift.area} · {shift.employer ? formatRating(shift.employer.rating_avg, shift.employer.rating_count) : ''}
        </T>
        <T variant="small" muted>
          The exact address and instructions are shown after you book.
        </T>
      </Card>
      {shift.description ? <T>{shift.description}</T> : null}
      {activeBooking ? (
        <Button title="View your booking" onPress={() => router.replace(`/booking/${booking!.id}`)} />
      ) : (
        <>
          {blocked ? <T muted>{blocked}</T> : null}
          <Button title="Claim shift" onPress={claim} loading={busy} disabled={!!blocked || shift.status !== 'open'} />
        </>
      )}
      <ErrorText error={error} />
    </Screen>
  );
}

type RosterBooking = Booking & { worker: NonNullable<Booking['worker']> };

function EmployerShift() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useQuery(async () => {
    const [shift, location, bookings, myRatings, favorites] = await Promise.all([
      supabase.from('shifts').select('*').eq('id', id).single(),
      supabase.from('shift_locations').select('*').eq('shift_id', id).maybeSingle(),
      supabase
        .from('bookings')
        .select('*, worker:profiles!bookings_worker_id_fkey(*)')
        .eq('shift_id', id)
        .neq('status', 'pending_payment')
        .order('created_at'),
      supabase.from('ratings').select('booking_id').eq('rater_id', profile!.id),
      supabase.from('favorites').select('worker_id').eq('employer_id', profile!.id),
    ]);
    return {
      shift: unwrap(shift) as Shift,
      location: unwrap(location) as ShiftLocation | null,
      bookings: unwrap(bookings) as RosterBooking[],
      rated: new Set((unwrap(myRatings) as { booking_id: string }[]).map((r) => r.booking_id)),
      favorites: new Set((unwrap(favorites) as { worker_id: string }[]).map((f) => f.worker_id)),
    };
  }, [id]);

  if (!data) return <Loading />;
  const { shift, location, bookings, rated, favorites } = data;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function cancelBooking(b: RosterBooking) {
    const late = hoursBetween(new Date().toISOString(), shift.starts_at) < 24;
    const ok = await confirm(
      `Cancel ${b.worker.full_name}?`,
      late
        ? 'The shift starts within 24 hours, so the worker will still receive half of their wage.'
        : 'You will get a full refund.',
    );
    if (ok) run(() => callFunction('cancel-booking', { booking_id: b.id }));
  }

  async function toggleFavorite(workerId: string) {
    run(async () => {
      if (favorites.has(workerId)) {
        await supabase.from('favorites').delete().eq('employer_id', profile!.id).eq('worker_id', workerId);
      } else {
        await supabase.from('favorites').insert({ employer_id: profile!.id, worker_id: workerId });
      }
    });
  }

  const active = bookings.filter((b) => !['cancelled_by_worker', 'cancelled_by_employer'].includes(b.status));

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <T variant="title">{shift.role_title}</T>
      <T muted>{formatShiftTime(shift.starts_at, shift.ends_at)}</T>
      <T muted>
        {location?.address ?? shift.area} · {formatMoney(shift.hourly_rate_cents, shift.currency.toUpperCase())}/h
      </T>
      <Row>
        <Badge text={shift.status} tone={shift.status === 'filled' ? 'success' : 'neutral'} />
        <Badge text={`${active.filter((b) => b.status !== 'no_show').length}/${shift.workers_needed} booked`} />
        {shift.is_urgent ? <Badge text="Urgent" tone="warning" /> : null}
      </Row>
      <ErrorText error={error} />

      <T variant="label" muted>
        Who&apos;s coming
      </T>
      {active.length === 0 ? <T muted>Nobody has booked yet. We&apos;ll notify you when someone does.</T> : null}
      {active.map((b) => (
        <Card key={b.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="heading">{b.worker.full_name}</T>
            <Badge text={BOOKING_LABELS[b.status]} tone={b.status === 'no_show' ? 'danger' : 'neutral'} />
          </Row>
          <T muted>
            {formatRating(b.worker.rating_avg, b.worker.rating_count)} · {b.worker.shifts_completed} shifts
            {b.is_repeat ? ' · worked with you before' : ''}
          </T>
          {b.wage_cents != null ? (
            <T variant="small" muted>
              Charged {formatMoney((b.wage_cents ?? 0) + (b.fee_cents ?? 0), shift.currency.toUpperCase())} (wage{' '}
              {formatMoney(b.wage_cents, shift.currency.toUpperCase())} + fee{' '}
              {formatMoney(b.fee_cents ?? 0, shift.currency.toUpperCase())})
            </T>
          ) : null}
          <Row style={{ flexWrap: 'wrap' }}>
            {['claimed', 'checked_in', 'checked_out', 'confirmed'].includes(b.status) ? (
              <Button title="Chat" variant="secondary" onPress={() => router.push(`/chat/${b.id}`)} />
            ) : null}
            {b.status === 'claimed' ? <Button title="Cancel" variant="secondary" onPress={() => cancelBooking(b)} /> : null}
            {['checked_out', 'confirmed', 'paid'].includes(b.status) ? (
              <Button
                title={favorites.has(b.worker_id) ? '★ Favorite' : '☆ Favorite'}
                variant="secondary"
                onPress={() => toggleFavorite(b.worker_id)}
              />
            ) : null}
          </Row>
          {b.status === 'checked_in' || b.status === 'checked_out' ? (
            <ConfirmHours booking={b} shift={shift} onConfirm={(minutes) => run(() => rpc('confirm_hours', { p_booking_id: b.id, p_minutes: minutes }))} />
          ) : null}
          {['checked_out', 'confirmed', 'paid'].includes(b.status) && !rated.has(b.id) ? (
            <RateCard bookingId={b.id} who={b.worker.full_name} onDone={reload} />
          ) : null}
        </Card>
      ))}

      {['open', 'filled'].includes(shift.status) && !active.some((b) => b.status !== 'no_show') ? (
        <Button
          title="Cancel this shift"
          variant="danger"
          onPress={async () => {
            if (await confirm('Cancel this shift?', 'It will be removed from the shift feed.')) {
              run(() => rpc('cancel_shift', { p_shift_id: shift.id }));
            }
          }}
        />
      ) : null}
    </Screen>
  );
}

function ConfirmHours({ booking, shift, onConfirm }: { booking: Booking; shift: Shift; onConfirm: (minutes: number) => void }) {
  const from = booking.check_in_at && booking.check_in_at > shift.starts_at ? booking.check_in_at : shift.starts_at;
  const to = booking.check_out_at && booking.check_out_at < shift.ends_at ? booking.check_out_at : shift.ends_at;
  const [hours, setHours] = useState(Math.max(0, hoursBetween(from, to)).toFixed(2));
  const minutes = Math.round(parseFloat(hours.replace(',', '.')) * 60);
  return (
    <Card style={{ padding: 0 }}>
      <Field
        label="Hours worked"
        keyboardType="decimal-pad"
        value={hours}
        onChangeText={setHours}
        hint="From check-in and check-out. If you don't confirm within 24 hours after check-out, these hours are confirmed automatically."
      />
      <Button title="Confirm hours" onPress={() => onConfirm(minutes)} disabled={!(minutes >= 0)} />
    </Card>
  );
}
