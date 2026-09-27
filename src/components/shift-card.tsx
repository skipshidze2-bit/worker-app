import { useT } from '@/lib/i18n';
import { Badge, Card, Row, T } from '@/components/ui';
import { formatMoney, formatRating, formatShiftTime, hoursBetween } from '@/lib/format';
import type { Shift } from '@/lib/types';

import { wageCents, shiftMinutes } from '@shared/pricing';

export function ShiftCard({ shift, onPress, footer }: { shift: Shift; onPress?: () => void; footer?: string }) {
  const { t } = useT();
  const hours = hoursBetween(shift.starts_at, shift.ends_at);
  return (
    <Card onPress={onPress}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="heading" style={{ flexShrink: 1 }}>
          {shift.role_title}
        </T>
        <T variant="heading">{formatMoney(shift.hourly_rate_cents, shift.currency.toUpperCase())}/h</T>
      </Row>
      <T muted>{formatShiftTime(shift.starts_at, shift.ends_at)}</T>
      <T muted>
        {shift.businesses?.name ? `${shift.businesses.name} · ` : ''}
        {shift.area}
        {shift.employer ? ` · ${formatRating(shift.employer.rating_avg, shift.employer.rating_count)}` : ''}
      </T>
      <Row>
        <Badge
          text={t('common.hoursTotal', {
            hours: hours.toFixed(1),
            amount: formatMoney(wageCents(shift.hourly_rate_cents, shiftMinutes(shift.starts_at, shift.ends_at)), shift.currency.toUpperCase()),
          })}
          tone="success"
        />
        {shift.is_urgent ? <Badge text={t('common.urgent')} tone="warning" /> : null}
        {footer ? <Badge text={footer} /> : null}
      </Row>
    </Card>
  );
}
