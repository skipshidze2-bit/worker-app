import { useState } from 'react';

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
        <T variant="heading">How will you use the app?</T>
        <Card onPress={() => setRole('worker')}>
          <T variant="heading">I want to work</T>
          <T muted>Pick up one-day shifts near you. Free, and paid the next day.</T>
        </Card>
        <Card onPress={() => setRole('employer')}>
          <T variant="heading">I need staff</T>
          <T muted>Post a shift and get verified workers, with a replacement if anyone doesn&apos;t show.</T>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Field label="Your full name" value={fullName} onChangeText={setFullName} autoComplete="name" />
      {role === 'worker' ? (
        <>
          <T variant="label" muted>
            What work can you do?
          </T>
          <Chips options={CATEGORIES} value={skills as (typeof CATEGORIES)[number][]} onChange={setSkills} />
          <Field label="Areas you can work in" placeholder="Old Town, Vake, Saburtalo" value={areas} onChangeText={setAreas} />
          <Field label="Languages" placeholder="English, Georgian" value={languages} onChangeText={setLanguages} />
          <Card>
            <T variant="heading">Verify your identity</T>
            <T muted>Employers only see verified workers. Your photos are private and only seen by our team.</T>
            <Row>
              <Button title={idPath ? 'ID photo ✓' : 'Photo of your ID'} variant="secondary" onPress={() => capture('id')} />
              <Button title={selfiePath ? 'Selfie ✓' : 'Take a selfie'} variant="secondary" onPress={() => capture('selfie')} />
            </Row>
          </Card>
        </>
      ) : (
        <>
          <Field label="Business name" value={businessName} onChangeText={setBusinessName} />
          <Field label="Company registration number (optional)" value={legalId} onChangeText={setLegalId} />
        </>
      )}
      <T variant="small" muted>
        By continuing you agree to the terms, including arranging all shifts with people you meet here through the app.
      </T>
      <Button title="Create profile" onPress={submit} loading={busy} disabled={!ready} />
      <Button title="Back" variant="secondary" onPress={() => setRole(null)} />
      <ErrorText error={error} />
    </Screen>
  );
}
