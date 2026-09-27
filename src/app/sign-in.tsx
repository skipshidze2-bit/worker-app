import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { useT } from '@/lib/i18n';
import { Button, ErrorText, Field, Screen, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const { t } = useT();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = phone.replace(/[^\d+]/g, '');

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ phone: normalized, token: code.trim(), type: 'sms' });
    setBusy(false);
    if (error) setError(error.message);
    // On success the session changes and the root layout routes onward.
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <T variant="title" style={{ marginTop: 80 }}>
          {t('signIn.title')}
        </T>
        <T muted>{t('signIn.subtitle')}</T>
        {!sent ? (
          <>
            <Field
              label={t('signIn.phone')}
              placeholder="+995 5XX XX XX XX"
              keyboardType="phone-pad"
              autoComplete="tel"
              value={phone}
              onChangeText={setPhone}
            />
            <Button title={t('signIn.sendCode')} onPress={sendCode} loading={busy} disabled={normalized.length < 8} />
          </>
        ) : (
          <>
            <T>{t('signIn.codeSent', { phone: normalized })}</T>
            <Field
              label={t('signIn.code')}
              placeholder="123456"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              value={code}
              onChangeText={setCode}
            />
            <Button title={t('signIn.continue')} onPress={verify} loading={busy} disabled={code.trim().length < 4} />
            <Button title={t('signIn.otherNumber')} variant="secondary" onPress={() => setSent(false)} />
          </>
        )}
        <ErrorText error={error} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
