import { router } from 'expo-router';

import { Badge, Button, Card, Row, Screen, T } from '@/components/ui';
import { formatRating } from '@/lib/format';
import { useSession } from '@/lib/session';

export function ProfileScreen() {
  const { profile, privateProfile, signOut, refresh } = useSession();
  if (!profile) return null;
  const isWorker = profile.role === 'worker';

  return (
    <Screen onRefresh={refresh}>
      <Card>
        <T variant="title">{profile.full_name}</T>
        <T muted>{formatRating(profile.rating_avg, profile.rating_count)}</T>
        <Row>
          {isWorker ? <Badge text={`${profile.shifts_completed} shifts`} /> : null}
          {isWorker ? (
            <Badge
              text={profile.id_status === 'approved' ? 'ID verified' : profile.id_status === 'pending' ? 'ID check pending' : 'ID rejected'}
              tone={profile.id_status === 'approved' ? 'success' : 'warning'}
            />
          ) : null}
          {isWorker && profile.strikes > 0 ? <Badge text={`${profile.strikes}/3 strikes`} tone="danger" /> : null}
        </Row>
        {profile.skills.length ? <T muted>{profile.skills.join(' · ')}</T> : null}
        {profile.areas.length ? <T muted>Areas: {profile.areas.join(', ')}</T> : null}
        {profile.languages.length ? <T muted>Languages: {profile.languages.join(', ')}</T> : null}
      </Card>
      <T variant="small" muted>
        Your phone number is never shown to {isWorker ? 'employers' : 'workers'}. Chat and calls go through the app.
      </T>
      <Button title="Edit profile" variant="secondary" onPress={() => router.push('/edit-profile')} />
      <Button
        title={
          isWorker
            ? privateProfile?.payouts_enabled
              ? 'Payouts: set up'
              : 'Set up payouts'
            : privateProfile?.has_payment_method
              ? 'Payment card: saved'
              : 'Add a payment card'
        }
        variant="secondary"
        onPress={() => router.push('/payments')}
      />
      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
