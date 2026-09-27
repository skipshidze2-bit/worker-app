import { router } from 'expo-router';

import { Button, Card, Empty, ErrorText, Row, Screen, T } from '@/components/ui';
import { formatRating } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { unwrap, useQuery } from '@/lib/use-query';

type Favorite = { worker_id: string; worker: Profile };

export default function FavoriteWorkers() {
  const { profile } = useSession();
  const { data, error, loading, reload } = useQuery(
    async () =>
      unwrap(
        await supabase
          .from('favorites')
          .select('worker_id, worker:profiles!favorites_worker_id_fkey(*)')
          .eq('employer_id', profile!.id),
      ) as unknown as Favorite[],
  );

  async function remove(workerId: string) {
    await supabase.from('favorites').delete().eq('employer_id', profile!.id).eq('worker_id', workerId);
    reload();
  }

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <T muted>
        Workers you&apos;ve favorited get your new shifts first, and you pay a lower fee when they work for you again.
      </T>
      <ErrorText error={error} />
      {data?.map((f) => (
        <Card key={f.worker_id}>
          <T variant="heading">{f.worker.full_name}</T>
          <T muted>
            {formatRating(f.worker.rating_avg, f.worker.rating_count)} · {f.worker.shifts_completed} shifts
          </T>
          {f.worker.skills.length ? <T muted>{f.worker.skills.join(' · ')}</T> : null}
          <Row>
            <Button title="Remove" variant="secondary" onPress={() => remove(f.worker_id)} />
          </Row>
        </Card>
      ))}
      {data && data.length === 0 ? <Empty text="Tap “Favorite” on a worker after a shift to add them here." /> : null}
      {data && data.length > 0 ? (
        <Button title="Rebook: post a shift for favorites" onPress={() => router.push({ pathname: '/post', params: { favorites: '1' } })} />
      ) : null}
    </Screen>
  );
}
