import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import { Button, Card, ErrorText, Field, Screen, T } from '@/components/ui';
import { normalizeIban } from '@/lib/iban';
import { useSession } from '@/lib/session';
import { callFunction, supabase } from '@/lib/supabase';

export default function Payments() {
  const { profile, privateProfile, refresh } = useSession();
  const [iban, setIban] = useState(privateProfile?.payout_iban ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setMessage(null);
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
          <T variant="heading">
            {privateProfile?.has_payment_method ? `Card saved ${privateProfile.card_mask ?? ''}` : 'Add a payment card'}
          </T>
          <T muted>
            Each time a worker books your shift we charge the wage plus our fee and hold it until the shift is done. If they
            don&apos;t show up, you&apos;re refunded and we look for a replacement.
          </T>
        </Card>
        <Button
          title={privateProfile?.has_payment_method ? 'Replace card' : 'Add card'}
          loading={busy}
          onPress={() =>
            run(async () => {
              const { url } = await callFunction<{ url: string }>('payment-setup');
              await WebBrowser.openAuthSessionAsync(url, 'workerapp://payments');
              setMessage('If you finished adding the card, it will show here in a few seconds.');
              setTimeout(refresh, 3000);
            })
          }
        />
        {message ? <T muted>{message}</T> : null}
        <ErrorText error={error} />
      </Screen>
    );
  }

  const valid = normalizeIban(iban);
  return (
    <Screen>
      <Card>
        <T variant="heading">{privateProfile?.payouts_enabled ? 'Payouts are set up' : 'Where should we send your pay?'}</T>
        <T muted>
          Employers pay upfront, so your pay is guaranteed. It reaches your bank account by the next working day after your hours
          are confirmed. We never take a cut of your wage.
        </T>
      </Card>
      <Field
        label="Your bank account (IBAN)"
        placeholder="GE00 XX00 0000 0000 0000 00"
        autoCapitalize="characters"
        value={iban}
        onChangeText={setIban}
        hint="Find it in your bank app (TBC, Bank of Georgia, Liberty…). It must be in your own name."
      />
      <Button
        title="Save"
        loading={busy}
        disabled={!valid || valid === privateProfile?.payout_iban}
        onPress={() =>
          run(async () => {
            const { error } = await supabase.from('private_profiles').update({ payout_iban: valid }).eq('id', profile!.id);
            if (error) throw new Error(error.message);
            await refresh();
            setMessage('Saved.');
          })
        }
      />
      {iban.trim() && !valid ? <T muted>That doesn&apos;t look like a Georgian IBAN yet.</T> : null}
      {message ? <T muted>{message}</T> : null}
      <ErrorText error={error} />
    </Screen>
  );
}
