import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import { Badge, Button, Card, ErrorText, Row, Screen, T } from '@/components/ui';
import { useSession } from '@/lib/session';
import { rpc, supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { unwrap, useQuery } from '@/lib/use-query';

type Pending = Profile & { private_profiles: { id_document_path: string | null; selfie_path: string | null } | null };
type Flag = { id: number; reasons: string[]; created_at: string; user: Pick<Profile, 'id' | 'full_name' | 'role' | 'suspended'> };

/**
 * First version of the admin panel: approve IDs, review contact-sharing attempts
 * and suspend accounts. Refunds and disputes are handled in the Stripe and
 * Supabase dashboards for now.
 */
export default function Admin() {
  const { signOut } = useSession();
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useQuery(async () => {
    const [pending, flags] = await Promise.all([
      supabase
        .from('profiles')
        .select('*, private_profiles(id_document_path, selfie_path)')
        .eq('role', 'worker')
        .eq('id_status', 'pending')
        .order('created_at'),
      supabase
        .from('bypass_flags')
        .select('id, reasons, created_at, user:profiles(id, full_name, role, suspended)')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    return { pending: unwrap(pending) as Pending[], flags: unwrap(flags) as unknown as Flag[] };
  });

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function view(path: string | null) {
    if (!path) return;
    const { data: signed } = await supabase.storage.from('id-documents').createSignedUrl(path, 300);
    if (signed?.signedUrl) await WebBrowser.openBrowserAsync(signed.signedUrl);
  }

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <ErrorText error={error} />
      <T variant="label" muted>
        ID checks waiting ({data?.pending.length ?? 0})
      </T>
      {data?.pending.map((p) => (
        <Card key={p.id}>
          <T variant="heading">{p.full_name}</T>
          <T muted>{p.skills.join(' · ')}</T>
          <Row style={{ flexWrap: 'wrap' }}>
            <Button title="View ID" variant="secondary" onPress={() => view(p.private_profiles?.id_document_path ?? null)} />
            <Button title="View selfie" variant="secondary" onPress={() => view(p.private_profiles?.selfie_path ?? null)} />
          </Row>
          <Row>
            <Button title="Approve" onPress={() => run(() => rpc('admin_set_id_status', { p_user: p.id, p_status: 'approved' }))} />
            <Button
              title="Reject"
              variant="danger"
              onPress={() => run(() => rpc('admin_set_id_status', { p_user: p.id, p_status: 'rejected' }))}
            />
          </Row>
        </Card>
      ))}

      <T variant="label" muted>
        Contact-sharing attempts
      </T>
      {data?.flags.map((f) => (
        <Card key={f.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="heading">
              {f.user.full_name} ({f.user.role})
            </T>
            {f.user.suspended ? <Badge text="Suspended" tone="danger" /> : null}
          </Row>
          <T muted>
            {f.reasons.join(', ')} · {new Date(f.created_at).toLocaleString()}
          </T>
          <Button
            title={f.user.suspended ? 'Unsuspend' : 'Suspend'}
            variant="secondary"
            onPress={() => run(() => rpc('admin_set_suspended', { p_user: f.user.id, p_suspended: !f.user.suspended }))}
          />
        </Card>
      ))}
      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
