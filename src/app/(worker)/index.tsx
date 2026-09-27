import { router } from 'expo-router';
import { useState } from 'react';

import { ShiftCard } from '@/components/shift-card';
import { Card, Chips, Empty, ErrorText, Screen, T } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, type Shift } from '@/lib/types';
import { unwrap, useQuery } from '@/lib/use-query';

export default function ShiftFeed() {
  const { profile, privateProfile } = useSession();
  const [filter, setFilter] = useState<(typeof CATEGORIES)[number][]>([]);

  const { data, error, loading, reload } = useQuery(async () => {
    let q = supabase
      .from('shifts')
      .select('*, businesses(name), employer:profiles!shifts_employer_id_fkey(rating_avg, rating_count)')
      .eq('status', 'open')
      .gt('starts_at', new Date().toISOString())
      .order('is_urgent', { ascending: false })
      .order('starts_at')
      .limit(100);
    if (filter.length) q = q.in('category', filter);
    return unwrap(await q) as Shift[];
  }, [filter]);

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {profile?.id_status === 'pending' ? (
        <Card>
          <T variant="heading">We&apos;re checking your ID</T>
          <T muted>You can browse shifts now and claim them once you&apos;re verified, usually within a day.</T>
        </Card>
      ) : null}
      {profile?.suspended ? (
        <Card>
          <T variant="heading">Your account is suspended</T>
          <T muted>This happens after 3 strikes (no-shows or late cancellations). Contact support to appeal.</T>
        </Card>
      ) : null}
      {!privateProfile?.payouts_enabled ? (
        <Card onPress={() => router.push('/payments')}>
          <T variant="heading">Set up payouts</T>
          <T muted>Add your bank details so you get paid the day after each shift.</T>
        </Card>
      ) : null}
      <Chips options={CATEGORIES} value={filter} onChange={setFilter} />
      <ErrorText error={error} />
      {data?.map((s) => <ShiftCard key={s.id} shift={s} onPress={() => router.push(`/shift/${s.id}`)} />)}
      {data && data.length === 0 ? <Empty text="No open shifts right now. Pull down to refresh." /> : null}
    </Screen>
  );
}
