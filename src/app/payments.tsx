import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import { useT } from '@/lib/i18n';
import { Button, Card, ErrorText, Field, Screen, T } from '@/components/ui';
import { normalizeIban } from '@/lib/iban';
import { useSession } from '@/lib/session';
import { callFunction, supabase } from '@/lib/supabase';

export default function Payments() {
  const { t } = useT();
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
            {privateProfile?.has_payment_method
              ? t('pay.cardSaved', { mask: privateProfile.card_mask ?? '' })
              : t('pay.addCard')}
          </T>
          <T muted>
            {t('pay.cardExplain')}
          </T>
        </Card>
        <Button
          title={privateProfile?.has_payment_method ? t('pay.replaceCard') : t('pay.addCardButton')}
          loading={busy}
          onPress={() =>
            run(async () => {
              const { url } = await callFunction<{ url: string }>('payment-setup');
              await WebBrowser.openAuthSessionAsync(url, 'workerapp://payments');
              setMessage(t('pay.cardPending'));
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
        <T variant="heading">{privateProfile?.payouts_enabled ? t('pay.payoutsSet') : t('pay.payoutsAsk')}</T>
        <T muted>
          {t('pay.payoutsExplain')}
        </T>
      </Card>
      <Field
        label={t('pay.iban')}
        placeholder="GE00 XX00 0000 0000 0000 00"
        autoCapitalize="characters"
        value={iban}
        onChangeText={setIban}
        hint={t('pay.ibanHint')}
      />
      <Button
        title={t('common.save')}
        loading={busy}
        disabled={!valid || valid === privateProfile?.payout_iban}
        onPress={() =>
          run(async () => {
            const { error } = await supabase.from('private_profiles').update({ payout_iban: valid }).eq('id', profile!.id);
            if (error) throw new Error(error.message);
            await refresh();
            setMessage(t('pay.saved'));
          })
        }
      />
      {iban.trim() && !valid ? <T muted>{t('pay.ibanInvalid')}</T> : null}
      {message ? <T muted>{message}</T> : null}
      <ErrorText error={error} />
    </Screen>
  );
}
