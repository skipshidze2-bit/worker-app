import { router } from 'expo-router';

import { useT, type TKey } from '@/lib/i18n';
import { Badge, Button, Card, Row, Screen, T } from '@/components/ui';
import { formatRating } from '@/lib/format';
import { useSession } from '@/lib/session';

export function ProfileScreen() {
  const { t, lang, setLang } = useT();
  const { profile, privateProfile, signOut, refresh } = useSession();
  if (!profile) return null;
  const isWorker = profile.role === 'worker';

  return (
    <Screen onRefresh={refresh}>
      <Card>
        <T variant="title">{profile.full_name}</T>
        <T muted>{formatRating(profile.rating_avg, profile.rating_count)}</T>
        <Row>
          {isWorker ? <Badge text={t('common.shifts', { count: profile.shifts_completed })} /> : null}
          {isWorker ? (
            <Badge
              text={
                profile.id_status === 'approved'
                  ? t('prof.idVerified')
                  : profile.id_status === 'pending'
                    ? t('prof.idPending')
                    : t('prof.idRejected')
              }
              tone={profile.id_status === 'approved' ? 'success' : 'warning'}
            />
          ) : null}
          {isWorker && profile.strikes > 0 ? <Badge text={t('prof.strikes', { n: profile.strikes })} tone="danger" /> : null}
        </Row>
        {profile.skills.length ? <T muted>{profile.skills.map((s) => t(`cat.${s}` as TKey)).join(' · ')}</T> : null}
        {profile.areas.length ? <T muted>{t('prof.areas', { list: profile.areas.join(', ') })}</T> : null}
        {profile.languages.length ? <T muted>{t('prof.languages', { list: profile.languages.join(', ') })}</T> : null}
      </Card>
      <T variant="small" muted>
        {isWorker ? t('prof.privacyWorker') : t('prof.privacyEmployer')}
      </T>
      <Button title={t('prof.edit')} variant="secondary" onPress={() => router.push('/edit-profile')} />
      <Button
        title={
          isWorker
            ? privateProfile?.payouts_enabled
              ? t('prof.payoutsSet')
              : t('prof.payoutsAdd')
            : privateProfile?.has_payment_method
              ? t('prof.cardSaved')
              : t('prof.cardAdd')
        }
        variant="secondary"
        onPress={() => router.push('/payments')}
      />
      <Button title={t('prof.language')} variant="secondary" onPress={() => setLang(lang === 'ka' ? 'en' : 'ka')} />
      <Button title={t('prof.signOut')} variant="secondary" onPress={signOut} />
    </Screen>
  );
}
