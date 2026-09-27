import { useState } from 'react';

import { useT } from '@/lib/i18n';
import { Button, Card, Chips, ErrorText, Field, Row, Screen, T } from '@/components/ui';
import { captureAndUpload } from '@/lib/id-upload';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, type Role } from '@/lib/types';

const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export default function Onboarding() {
  const { t } = useT();
  const { session, refresh } = useSession();
  const userId = session!.user.id;
  const [role, setRole] = useState<Exclude<Role, 'admin'> | null>(null);
  const [fullName, setFullName] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [areas, setAreas] = useState('');
  const [languages, setLanguages] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [legalId, setLegalId] = useState('');
  const [idPath, setIdPath] = useState<string | null>(null);
  const [selfiePath, setSelfiePath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function capture(kind: 'id' | 'selfie') {
    setError(null);
    try {
      const path = await captureAndUpload(userId, kind);
      if (path) (kind === 'id' ? setIdPath : setSelfiePath)(path);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const ready =
    fullName.trim().length > 1 &&
    (role === 'worker' ? skills.length > 0 && !!idPath && !!selfiePath : businessName.trim().length > 1);

  async function submit() {
    if (!role) return;
    setBusy(true);
    setError(null);
    try {
      const { error: pErr } = await supabase.from('profiles').insert({
        id: userId,
        role,
        full_name: fullName.trim(),
        skills: role === 'worker' ? skills : [],
        areas: splitList(areas),
        languages: splitList(languages),
      });
      if (pErr) throw pErr;
      const { error: ppErr } = await supabase.from('private_profiles').insert({
        id: userId,
        phone: session!.user.phone ?? null,
        id_document_path: idPath,
        selfie_path: selfiePath,
      });
      if (ppErr) throw ppErr;
      if (role === 'employer') {
        const { error: bErr } = await supabase
          .from('businesses')
          .insert({ owner_id: userId, name: businessName.trim(), legal_id: legalId.trim() || null, contact_person: fullName.trim() });
        if (bErr) throw bErr;
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!role) {
    return (
      <Screen>
        <T variant="heading">{t('onb.howUse')}</T>
        <Card onPress={() => setRole('worker')}>
          <T variant="heading">{t('onb.work')}</T>
          <T muted>{t('onb.workSub')}</T>
        </Card>
        <Card onPress={() => setRole('employer')}>
          <T variant="heading">{t('onb.hire')}</T>
          <T muted>{t('onb.hireSub')}</T>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Field label={t('onb.fullName')} value={fullName} onChangeText={setFullName} autoComplete="name" />
      {role === 'worker' ? (
        <>
          <T variant="label" muted>
            {t('onb.skills')}
          </T>
          <Chips
            options={CATEGORIES}
            value={skills as (typeof CATEGORIES)[number][]}
            onChange={setSkills}
            label={(c) => t(`cat.${c}`)}
          />
          <Field label={t('onb.areas')} placeholder={t('onb.areasPh')} value={areas} onChangeText={setAreas} />
          <Field label={t('onb.languages')} placeholder={t('onb.languagesPh')} value={languages} onChangeText={setLanguages} />
          <Card>
            <T variant="heading">{t('onb.verify')}</T>
            <T muted>{t('onb.verifySub')}</T>
            <Row>
              <Button title={idPath ? t('onb.idDone') : t('onb.idPhoto')} variant="secondary" onPress={() => capture('id')} />
              <Button title={selfiePath ? t('onb.selfieDone') : t('onb.selfie')} variant="secondary" onPress={() => capture('selfie')} />
            </Row>
          </Card>
        </>
      ) : (
        <>
          <Field label={t('onb.business')} value={businessName} onChangeText={setBusinessName} />
          <Field label={t('onb.legalId')} value={legalId} onChangeText={setLegalId} />
        </>
      )}
      <T variant="small" muted>
        {t('onb.terms')}
      </T>
      <Button title={t('onb.create')} onPress={submit} loading={busy} disabled={!ready} />
      <Button title={t('common.back')} variant="secondary" onPress={() => setRole(null)} />
      <ErrorText error={error} />
    </Screen>
  );
}
