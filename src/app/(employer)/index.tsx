import { router } from 'expo-router';

import { ShiftCard } from '@/components/shift-card';
import { Button, Empty, ErrorText, Screen, T } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Shift } from '@/lib/types';
import { unwrap, useQuery } from '@/lib/use-query';

type ShiftWithCount = Shift & { bookings: { status: string }[] };
const ACTIVE = ['pending_payment', 'claimed', 'checked_in', 'checked_out', 'confirmed', 'paid'];

export default function EmployerShifts() {
  const { profile } = useSession();
  const { data, error, loading, reload } = useQuery(
    async () =>
      unwrap(
        await supabase
          .from('shifts')
          .select('*, bookings(status)')
          .eq('employer_id', profile!.id)
          .order('starts_at', { ascending: false })
          .limit(100),
      ) as ShiftWithCount[],
  );

  const now = new Date().toISOString();
  const upcoming = (data ?? []).filter((s) => s.ends_at > now && s.status !== 'cancelled').reverse();
  const past = (data ?? []).filter((s) => s.ends_at <= now || s.status === 'cancelled');
  const filled = (s: ShiftWithCount) => `${s.bookings.filter((b) => ACTIVE.includes(b.status)).length}/${s.workers_needed} booked`;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <ErrorText error={error} />
      <Button title="Post a shift" onPress={() => router.push('/post')} />
      <T variant="label" muted>
        Upcoming
      </T>
      {upcoming.map((s) => (
        <ShiftCard key={s.id} shift={s} footer={filled(s)} onPress={() => router.push(`/shift/${s.id}`)} />
      ))}
      {data && upcoming.length === 0 ? <Empty text="No upcoming shifts." /> : null}
      {past.length ? (
        <T variant="label" muted>
          Past
        </T>
      ) : null}
      {past.map((s) => (
        <ShiftCard key={s.id} shift={s} footer={s.status} onPress={() => router.push(`/shift/${s.id}`)} />
      ))}
    </Screen>
  );
}
