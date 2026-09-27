import { router } from 'expo-router';
import { useState } from 'react';

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
      <Field label="Full name" value={fullName} onChangeText={setFullName} />
      <Field label="About you" value={bio} onChangeText={setBio} multiline hint="Don't include phone numbers or social handles." />
      {profile.role === 'worker' ? (
        <>
          <T variant="label" muted>
            Skills
          </T>
          <Chips options={CATEGORIES} value={skills as (typeof CATEGORIES)[number][]} onChange={setSkills} />
        </>
      ) : null}
      <Field label="Areas" value={areas} onChangeText={setAreas} />
      <Field label="Languages" value={languages} onChangeText={setLanguages} />
      <Button title="Save" onPress={save} loading={busy} />
      <ErrorText error={error} />
    </Screen>
  );
}
