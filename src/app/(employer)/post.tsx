import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { useT } from '@/lib/i18n';
import { Button, Card, Chips, ErrorText, Field, Row, Screen, T } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { CATEGORIES } from '@/lib/types';

import { FEES, quoteShift } from '@shared/pricing';

const FAVORITES_HEAD_START_HOURS = 2;

function favoritesHeadStartUntil(): string {
  return new Date(Date.now() + FAVORITES_HEAD_START_HOURS * 3_600_000).toISOString();
}

function tomorrow(): string {
  const d = new Date(Date.now() + 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local date + HH:MM times to ISO timestamps. An end before the start means the next day. */
function parseTimes(date: string, start: string, end: string): { startsAt: Date; endsAt: Date } | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const s = /^(\d{1,2}):(\d{2})$/.exec(start.trim());
  const e = /^(\d{1,2}):(\d{2})$/.exec(end.trim());
  if (!d || !s || !e) return null;
  const startsAt = new Date(+d[1], +d[2] - 1, +d[3], +s[1], +s[2]);
  const endsAt = new Date(+d[1], +d[2] - 1, +d[3], +e[1], +e[2]);
  if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) return null;
  return { startsAt, endsAt };
}

export default function PostShift() {
  const { t } = useT();
  const { profile, privateProfile } = useSession();
  const params = useLocalSearchParams<{ favorites?: string }>();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number][]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(tomorrow());
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('18:00');
  const [workers, setWorkers] = useState('1');
  const [rate, setRate] = useState('15');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [favoritesFirst, setFavoritesFirst] = useState(params.favorites === '1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const times = parseTimes(date, start, end);
  const rateCents = Math.round(parseFloat(rate.replace(',', '.')) * 100);
  const workersNeeded = parseInt(workers, 10);
  const quote =
    times && rateCents > 0 && workersNeeded > 0
      ? quoteShift({ hourlyRateCents: rateCents, startsAt: times.startsAt, endsAt: times.endsAt, workersNeeded })
      : null;

  async function useCurrentLocation() {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return setError(t('post.locationNeeded'));
    const pos = await Location.getCurrentPositionAsync({});
    setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  }

  async function locate(): Promise<{ lat: number; lng: number }> {
    if (coords) return coords;
    const results = await Location.geocodeAsync(address).catch(() => []);
    if (!results[0]) throw new Error(t('post.addressNotFound'));
    return { lat: results[0].latitude, lng: results[0].longitude };
  }

  async function submit() {
    if (!times || !quote || !category[0]) return;
    setBusy(true);
    setError(null);
    try {
      const where = await locate();
      const { data: business, error: bErr } = await supabase.from('businesses').select('id').eq('owner_id', profile!.id).single();
      if (bErr) throw bErr;
      const { data: shift, error: sErr } = await supabase
        .from('shifts')
        .insert({
          employer_id: profile!.id,
          business_id: business.id,
          role_title: title.trim() || category[0],
          category: category[0],
          description: description.trim() || null,
          starts_at: times.startsAt.toISOString(),
          ends_at: times.endsAt.toISOString(),
          workers_needed: workersNeeded,
          hourly_rate_cents: rateCents,
          area: area.trim(),
          favorites_only_until: favoritesFirst ? favoritesHeadStartUntil() : null,
        })
        .select('id')
        .single();
      if (sErr) throw sErr;
      const { error: lErr } = await supabase.from('shift_locations').insert({
        shift_id: shift.id,
        address: address.trim(),
        lat: where.lat,
        lng: where.lng,
        instructions: instructions.trim() || null,
      });
      if (lErr) throw lErr;
      router.replace(`/shift/${shift.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!privateProfile?.has_payment_method) {
    return (
      <Screen>
        <T variant="heading">{t('post.cardFirst')}</T>
        <T muted>{t('post.cardFirstSub')}</T>
        <Button title={t('post.addCard')} onPress={() => router.push('/payments')} />
      </Screen>
    );
  }

  const ready = !!quote && !!category[0] && area.trim().length > 1 && address.trim().length > 3;

  return (
    <Screen>
      <T variant="label" muted>
        {t('post.type')}
      </T>
      <Chips
        options={CATEGORIES}
        value={category}
        onChange={(v) => setCategory(v.slice(-1))}
        label={(c) => t(`cat.${c}`)}
      />
      <Field label={t('post.title')} placeholder={t('post.titlePh')} value={title} onChangeText={setTitle} />
      <Field label={t('post.date')} placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
      <Row>
        <View style={{ flex: 1 }}>
          <Field label={t('post.start')} placeholder="10:00" value={start} onChangeText={setStart} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('post.end')} placeholder="18:00" value={end} onChangeText={setEnd} />
        </View>
      </Row>
      <Row>
        <View style={{ flex: 1 }}>
          <Field label={t('post.workers')} keyboardType="number-pad" value={workers} onChangeText={setWorkers} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('post.rate')} keyboardType="decimal-pad" value={rate} onChangeText={setRate} />
        </View>
      </Row>
      <Field label={t('post.area')} placeholder={t('post.areaPh')} value={area} onChangeText={setArea} />
      <Field
        label={t('post.address')}
        placeholder={t('post.addressPh')}
        value={address}
        onChangeText={(v) => {
          setAddress(v);
          setCoords(null);
        }}
        hint={t('post.addressHint')}
      />
      <Button title={coords ? t('post.pinned') : t('post.useLocation')} variant="secondary" onPress={useCurrentLocation} />
      <Field label={t('post.description')} value={description} onChangeText={setDescription} multiline />
      <Field
        label={t('post.instructions')}
        placeholder={t('post.instructionsPh')}
        value={instructions}
        onChangeText={setInstructions}
        multiline
      />
      <Row style={{ justifyContent: 'space-between' }}>
        <T style={{ flex: 1 }}>{t('post.favoritesFirst', { hours: FAVORITES_HEAD_START_HOURS })}</T>
        <Switch value={favoritesFirst} onValueChange={setFavoritesFirst} />
      </Row>

      {quote ? (
        <Card>
          <T variant="label" muted>
            {t('post.total')}
          </T>
          <T variant="title">{formatMoney(quote.totalCents)}</T>
          <T muted>
            {t('post.breakdown', {
              wage: formatMoney(quote.wageCents),
              fee: formatMoney(quote.feeCents),
              pct: quote.feeBps / 100,
            })}
          </T>
          <T variant="small" muted>
            {t('post.repeatNote', { repeat: FEES.repeatBookingBps / 100, first: FEES.firstBookingBps / 100 })}{' '}
            {quote.feeBps > FEES.firstBookingBps ? t('post.urgentNote', { pct: FEES.urgentSurchargeBps / 100 }) : ''}
          </T>
        </Card>
      ) : (
        <T muted>{t('post.enterDetails')}</T>
      )}
      <Button title={t('post.submit')} onPress={submit} loading={busy} disabled={!ready} />
      <ErrorText error={error} />
    </Screen>
  );
}
