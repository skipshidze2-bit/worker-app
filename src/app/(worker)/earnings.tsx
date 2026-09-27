import { Card, Empty, ErrorText, Row, Screen, T } from '@/components/ui';
import { formatDay, formatMoney } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Booking } from '@/lib/types';
import { unwrap, useQuery } from '@/lib/use-query';

export default function Earnings() {
  const { profile } = useSession();
  const { data, error, loading, reload } = useQuery(
    async () =>
      unwrap(
        await supabase
          .from('bookings')
          .select('*, shifts(role_title, starts_at, currency, businesses(name))')
          .eq('worker_id', profile!.id)
          .in('status', ['checked_out', 'confirmed', 'paid', 'cancelled_by_employer'])
          .order('created_at', { ascending: false }),
      ) as Booking[],
  );

  const rows = (data ?? []).filter((b) => b.status !== 'cancelled_by_employer' || (b.payout_cents ?? 0) > 0);
  const paid = rows.filter((b) => b.status === 'paid' || b.status === 'cancelled_by_employer');
  const pending = rows.filter((b) => b.status === 'checked_out' || b.status === 'confirmed');
  const sum = (list: Booking[]) => list.reduce((acc, b) => acc + (b.payout_cents ?? b.wage_cents ?? 0), 0);
  const currency = (rows[0]?.shifts?.currency ?? 'usd').toUpperCase();

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <ErrorText error={error} />
      <Row>
        <Card style={{ flex: 1 }}>
          <T variant="label" muted>
            Paid out
          </T>
          <T variant="title">{formatMoney(sum(paid), currency)}</T>
        </Card>
        <Card style={{ flex: 1 }}>
          <T variant="label" muted>
            On the way
          </T>
          <T variant="title">{formatMoney(sum(pending), currency)}</T>
        </Card>
      </Row>
      <T variant="small" muted>
        Pay is sent the day after the employer confirms your hours, or automatically 24 hours after you check out.
      </T>
      {rows.map((b) => (
        <Card key={b.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T>{b.shifts?.role_title}</T>
            <T variant="heading">{formatMoney(b.payout_cents ?? b.wage_cents ?? 0, currency)}</T>
          </Row>
          <T muted variant="small">
            {b.shifts ? formatDay(b.shifts.starts_at) : ''} · {b.status === 'paid' ? 'Paid' : b.status === 'cancelled_by_employer' ? 'Late cancellation pay' : 'Pending'}
          </T>
        </Card>
      ))}
      {data && rows.length === 0 ? <Empty text="Your earnings will show here after your first shift." /> : null}
    </Screen>
  );
}
