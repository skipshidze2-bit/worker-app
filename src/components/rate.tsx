import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { useT } from '@/lib/i18n';
import { Button, Card, ErrorText, Field, Row, T } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { rpc } from '@/lib/supabase';

export function RateCard({ bookingId, who, onDone }: { bookingId: string; who: string; onDone: () => void }) {
  const { t } = useT();
  const theme = useTheme();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    try {
      await rpc('rate_booking', { p_booking_id: bookingId, p_stars: stars, p_comment: comment.trim() || null });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <T variant="heading">{t('rate.title', { name: who })}</T>
      <Row>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setStars(n)} accessibilityLabel={`${n} stars`}>
            <Text style={{ fontSize: 32, color: n <= stars ? theme.warning : theme.textSecondary }}>★</Text>
          </Pressable>
        ))}
      </Row>
      <Field label={t('rate.comment')} value={comment} onChangeText={setComment} />
      <Button title={t('rate.submit')} onPress={submit} disabled={!stars} loading={busy} />
      <ErrorText error={error} />
    </Card>
  );
}
