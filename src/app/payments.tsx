import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import { Button, Card, ErrorText, Screen, T } from '@/components/ui';
import { useSaveCard } from '@/lib/payments';
import { useSession } from '@/lib/session';
import { callFunction } from '@/lib/supabase';

export default function Payments() {
  const { profile, privateProfile, refresh } = useSession();
  const saveCard = useSaveCard();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (profile?.role === 'employer') {
    return (
      <Screen>
        <Card>
          <T variant="heading">{privateProfile?.has_payment_method ? 'Card saved' : 'Add a payment card'}</T>
          <T muted>
            Each time a worker books your shift we charge the wage plus our fee and hold it until the shift is done. If they
            don&apos;t show up, you&apos;re refunded and we look for a replacement. You get a receipt for every charge.
          </T>
        </Card>
        <Button
          title={privateProfile?.has_payment_method ? 'Replace card' : 'Add card'}
          loading={busy}
          onPress={() =>
            run(async () => {
              if (await saveCard()) {
                setMessage('Card saved. It can take a few seconds to show here.');
                setTimeout(refresh, 3000);
              }
            })
          }
        />
        {message ? <T muted>{message}</T> : null}
        <ErrorText error={error} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <T variant="heading">{privateProfile?.payouts_enabled ? 'Payouts are set up' : 'Set up payouts'}</T>
        <T muted>
          Employers pay upfront, so your pay is guaranteed. It&apos;s sent to your bank the day after your hours are confirmed. We
          never take a cut of your wage.
        </T>
      </Card>
      <Button
        title={privateProfile?.payouts_enabled ? 'Update bank details' : 'Add bank details'}
        loading={busy}
        onPress={() =>
          run(async () => {
            const { onboarding_url } = await callFunction<{ onboarding_url: string }>('stripe-setup');
            await WebBrowser.openBrowserAsync(onboarding_url);
            await refresh();
          })
        }
      />
      <ErrorText error={error} />
    </Screen>
  );
}
