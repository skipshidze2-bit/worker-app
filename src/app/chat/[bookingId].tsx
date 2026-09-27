import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorText, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import { formatTime } from '@/lib/format';
import { useSession } from '@/lib/session';
import { callFunction, supabase } from '@/lib/supabase';
import type { Message } from '@/lib/types';

import { maskContactInfo } from '@shared/contact-mask';

export default function Chat() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { profile } = useSession();
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<FlatList<Message>>(null);

  useEffect(() => {
    supabase
      .from('messages')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at')
      .then(({ data }) => setMessages(data ?? []));

    const channel = supabase
      .channel(`chat-${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` },
        (payload) =>
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new as Message])),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    if (maskContactInfo(body).masked) {
      const ok = await confirm(
        'Contact details will be hidden',
        'Phone numbers, emails and social handles are hidden in chat. Keep everything in the app: that is how pay is guaranteed and no-shows are replaced. Send anyway?',
      );
      if (!ok) return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await callFunction<{ message: Message }>('send-message', { booking_id: bookingId, body });
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      setText('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            <T variant="small" muted style={{ textAlign: 'center', marginBottom: Spacing.two }}>
              For your safety, phone numbers and other contact details are hidden. Chat closes after the shift is paid.
            </T>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === profile?.id;
            return (
              <View
                style={[
                  styles.bubble,
                  mine
                    ? { alignSelf: 'flex-end', backgroundColor: theme.tint }
                    : { alignSelf: 'flex-start', backgroundColor: theme.backgroundElement },
                ]}>
                <Text style={{ color: mine ? theme.onTint : theme.text, fontSize: 16 }}>{item.body}</Text>
                <Text style={{ color: mine ? theme.onTint : theme.textSecondary, fontSize: 11, opacity: 0.8 }}>
                  {formatTime(item.created_at)}
                  {item.was_masked ? ' · contact details hidden' : ''}
                </Text>
              </View>
            );
          }}
        />
        <ErrorText error={error} />
        <View style={[styles.composer, { borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            placeholder="Message"
            placeholderTextColor={theme.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
          />
          <View style={{ width: 90 }}>
            <Button title="Send" onPress={send} loading={sending} disabled={!text.trim()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, padding: Spacing.two, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, maxHeight: 120 },
});
