import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { translateError, useT } from '@/lib/i18n';

export function Screen({
  children,
  refreshing,
  onRefresh,
  scroll = true,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
}) {
  const theme = useTheme();
  const content = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

type Variant = 'title' | 'heading' | 'body' | 'small' | 'label';

export function T({ variant = 'body', muted, style, ...props }: TextProps & { variant?: Variant; muted?: boolean }) {
  const theme = useTheme();
  return (
    <Text
      {...props}
      style={[styles[variant], { color: muted ? theme.textSecondary : theme.text }, style]}
    />
  );
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: ViewStyle }) {
  const theme = useTheme();
  const cardStyle = [styles.card, { backgroundColor: theme.backgroundElement }, style];
  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const bg = variant === 'primary' ? theme.tint : variant === 'danger' ? theme.danger : theme.backgroundSelected;
  const fg = variant === 'secondary' ? theme.text : theme.onTint;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      <T variant="label" muted>
        {label}
      </T>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        {...props}
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
          props.multiline && { minHeight: 90, textAlignVertical: 'top' },
        ]}
      />
      {hint ? (
        <T variant="small" muted>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export function Chips<V extends string>({
  options,
  value,
  onChange,
  label = (o) => o,
}: {
  options: readonly V[];
  value: V[];
  onChange: (next: V[]) => void;
  label?: (option: V) => string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <Pressable
            key={o}
            onPress={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
            style={[styles.chip, { backgroundColor: on ? theme.tint : theme.backgroundSelected }]}>
            <Text style={{ color: on ? theme.onTint : theme.text }}>{label(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Badge({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'tint' }) {
  const theme = useTheme();
  const color = tone === 'neutral' ? theme.textSecondary : theme[tone];
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.small, { color }]}>{text}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Empty({ text }: { text: string }) {
  return (
    <T muted style={{ textAlign: 'center', marginTop: Spacing.five }}>
      {text}
    </T>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  const theme = useTheme();
  const { lang } = useT();
  if (!error) return null;
  return <Text style={[styles.small, { color: theme.danger }]}>{translateError(lang, error)}</Text>;
}

export function Loading() {
  return <ActivityIndicator style={{ marginTop: Spacing.five }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
    flexGrow: 1,
  },
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16 },
  small: { fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  button: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: Spacing.three, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
