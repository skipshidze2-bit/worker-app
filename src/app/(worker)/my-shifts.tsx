import { router } from 'expo-router';

import { useT } from '@/lib/i18n';
import { ShiftCard } from '@/components/shift-card';
import { Empty, ErrorText, Screen, T } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Booking } from '@/lib/types';
import { unwrap, useQuery } from '@/lib/use-query';

const UPCOMING = ['claimed', 'checked_in'];

export default function MyShifts() {
  const { t } = useT();
  const { profile } = useSession();
  const { data, error, loading, reload } = useQuery(
    async () =>
      unwrap(
        await supabase
          .from('bookings')
          .select('*, shifts(*, businesses(name))')
          .eq('worker_id', profile!.id)
          .neq('status', 'pending_payment')
          .order('created_at', { ascending: false })
          .limit(100),
      ) as Booking[],
  );

  const upcoming = (data ?? [])
    .filter((b) => UPCOMING.includes(b.status))
    .sort((a, b) => a.shifts!.starts_at.localeCompare(b.shifts!.starts_at));
  const past = (data ?? []).filter((b) => !UPCOMING.includes(b.status));

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <ErrorText error={error} />
      <T variant="label" muted>
        {t('common.upcoming')}
      </T>
      {upcoming.map((b) => (
        <ShiftCard key={b.id} shift={b.shifts!} footer={t(`status.${b.status}`)} onPress={() => router.push(`/booking/${b.id}`)} />
      ))}
      {data && upcoming.length === 0 ? <Empty text={t('my.empty')} /> : null}
      {past.length ? (
        <T variant="label" muted>
          {t('common.past')}
        </T>
      ) : null}
      {past.map((b) => (
        <ShiftCard key={b.id} shift={b.shifts!} footer={t(`status.${b.status}`)} onPress={() => router.push(`/booking/${b.id}`)} />
      ))}
    </Screen>
  );
}
