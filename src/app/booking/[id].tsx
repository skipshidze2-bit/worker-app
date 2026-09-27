import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform } from 'react-native';

import { RateCard } from '@/components/rate';
import { Badge, Button, Card, ErrorText, Loading, Row, Screen, T } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { formatMoney, formatShiftTime, formatTime, hoursBetween } from '@/lib/format';
import { useSession } from '@/lib/session';
import { callFunction, rpc, supabase } from '@/lib/supabase';
import { BOOKING_LABELS, type Booking, type ShiftLocation } from '@/lib/types';
import { unwrap, useQuery } from '@/lib/use-query';

export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useQuery(async () => {
    const booking = unwrap(
      await supabase.from('bookings').select('*, shifts(*, businesses(name))').eq('id', id).single(),
    ) as Booking;
    const [location, rating] = await Promise.all([
      supabase.from('shift_locations').select('*').eq('shift_id', booking.shift_id).maybeSingle(),
      supabase.from('ratings').select('booking_id').eq('booking_id', id).eq('rater_id', profile!.id).maybeSingle(),
    ]);
    return { booking, location: unwrap(location) as ShiftLocation | null, rated: !!rating.data };
  }, [id]);

  if (!data) return <Loading />;
  const { booking, location, rated } = data;
  const shift = booking.shifts!;
  const currency = shift.currency.toUpperCase();

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const checkIn = () =>
    act(async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) throw new Error('Location is needed to check in at the job site.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await rpc('check_in', { p_booking_id: booking.id, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude });
    });

  const checkOut = async () => {
    if (await confirm('Check out?', 'Your hours are counted until now.')) {
      act(() => rpc('check_out', { p_booking_id: booking.id }));
    }
  };

  const cancel = async () => {
    const late = hoursBetween(new Date().toISOString(), shift.starts_at) < 24;
    const ok = await confirm(
      'Cancel this shift?',
      late
        ? 'The shift starts within 24 hours, so cancelling now gives you a strike. 3 strikes suspend your account.'
        : 'You can cancel for free because the shift is more than 24 hours away.',
    );
    if (ok) {
      await act(() => callFunction('cancel-booking', { booking_id: booking.id }));
      router.back();
    }
  };

  const openMaps = () => {
    if (!location) return;
    const q = `${location.lat},${location.lng}`;
    Linking.openURL(
      Platform.OS === 'ios' ? `maps:?q=${encodeURIComponent(location.address)}&ll=${q}` : `geo:${q}?q=${q}(${encodeURIComponent(location.address)})`,
    );
  };

  const chatOpen = ['claimed', 'checked_in', 'checked_out', 'confirmed'].includes(booking.status);

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <T variant="title">{shift.role_title}</T>
      <T muted>{formatShiftTime(shift.starts_at, shift.ends_at)}</T>
      <Row>
        <Badge text={BOOKING_LABELS[booking.status]} tone={booking.status === 'paid' ? 'success' : 'tint'} />
        <Badge text={`${formatMoney(booking.payout_cents ?? booking.wage_cents ?? 0, currency)}`} tone="success" />
      </Row>

      <Card>
        <T variant="heading">{shift.businesses?.name}</T>
        {location ? (
          <>
            <T>{location.address}</T>
            {location.instructions ? <T muted>{location.instructions}</T> : null}
            <Button title="Open in maps" variant="secondary" onPress={openMaps} />
          </>
        ) : (
          <T muted>{shift.area}</T>
        )}
      </Card>

      {booking.status === 'claimed' ? (
        <Card>
          <T variant="heading">When you arrive</T>
          <T muted>Check in at the job site. It opens 30 minutes before the start and uses your location.</T>
          <Button title="Check in" onPress={checkIn} loading={busy} />
        </Card>
      ) : null}
      {booking.status === 'checked_in' ? (
        <Card>
          <T>Checked in at {formatTime(booking.check_in_at!)}.</T>
          <Button title="Check out" onPress={checkOut} loading={busy} />
        </Card>
      ) : null}
      {booking.status === 'checked_out' ? (
        <T muted>
          Checked out at {formatTime(booking.check_out_at!)}. The employer has 24 hours to confirm your hours, then they&apos;re
          confirmed automatically and you&apos;re paid.
        </T>
      ) : null}

      {chatOpen ? <Button title="Message the employer" variant="secondary" onPress={() => router.push(`/chat/${booking.id}`)} /> : null}
      {['checked_out', 'confirmed', 'paid'].includes(booking.status) && !rated ? (
        <RateCard bookingId={booking.id} who={shift.businesses?.name ?? 'the employer'} onDone={reload} />
      ) : null}
      {booking.status === 'claimed' ? <Button title="Cancel shift" variant="danger" onPress={cancel} disabled={busy} /> : null}
      <ErrorText error={error} />
    </Screen>
  );
}
