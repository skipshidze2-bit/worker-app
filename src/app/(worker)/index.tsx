import { router } from 'expo-router';
import { useState } from 'react';

import { useT } from '@/lib/i18n';
import { ShiftCard } from '@/components/shift-card';
import { Card, Chips, Empty, ErrorText, Screen, T } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, type Shift } from '@/lib/types';
import { unwrap, useQuery } from '@/lib/use-query';

export default function ShiftFeed() {
  const { t } = useT();
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
          <T variant="heading">{t('feed.idPending')}</T>
          <T muted>{t('feed.idPendingSub')}</T>
        </Card>
      ) : null}
      {profile?.suspended ? (
        <Card>
          <T variant="heading">{t('feed.suspended')}</T>
          <T muted>{t('feed.suspendedSub')}</T>
        </Card>
      ) : null}
      {!privateProfile?.payouts_enabled ? (
        <Card onPress={() => router.push('/payments')}>
          <T variant="heading">{t('feed.setupPayouts')}</T>
          <T muted>{t('feed.setupPayoutsSub')}</T>
        </Card>
      ) : null}
      <Chips options={CATEGORIES} value={filter} onChange={setFilter} label={(c) => t(`cat.${c}`)} />
      <ErrorText error={error} />
      {data?.map((s) => <ShiftCard key={s.id} shift={s} onPress={() => router.push(`/shift/${s.id}`)} />)}
      {data && data.length === 0 ? <Empty text={t('feed.empty')} /> : null}
    </Screen>
  );
}
