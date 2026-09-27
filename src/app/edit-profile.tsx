import { router } from 'expo-router';
import { useState } from 'react';

import { useT } from '@/lib/i18n';
import { Button, Chips, ErrorText, Field, Screen, T } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { CATEGORIES } from '@/lib/types';

const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export default function EditProfile() {
  const { t } = useT();
  const { profile, refresh } = useSession();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [skills, setSkills] = useState<string[]>(profile?.skills ?? []);
  const [areas, setAreas] = useState(profile?.areas.join(', ') ?? '');
  const [languages, setLanguages] = useState(profile?.languages.join(', ') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!profile) return null;

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        bio: bio.trim() || null,
        skills,
        areas: splitList(areas),
        languages: splitList(languages),
      })
      .eq('id', profile!.id);
    setBusy(false);
    if (error) return setError(error.message);
    await refresh();
    router.back();
  }

  return (
    <Screen>
      <Field label={t('edit.fullName')} value={fullName} onChangeText={setFullName} />
      <Field label={t('edit.about')} value={bio} onChangeText={setBio} multiline hint={t('edit.aboutHint')} />
      {profile.role === 'worker' ? (
        <>
          <T variant="label" muted>
            {t('edit.skills')}
          </T>
          <Chips
            options={CATEGORIES}
            value={skills as (typeof CATEGORIES)[number][]}
            onChange={setSkills}
            label={(c) => t(`cat.${c}`)}
          />
        </>
      ) : null}
      <Field label={t('edit.areas')} value={areas} onChangeText={setAreas} />
      <Field label={t('onb.languages')} value={languages} onChangeText={setLanguages} />
      <Button title={t('common.save')} onPress={save} loading={busy} />
      <ErrorText error={error} />
    </Screen>
  );
}
