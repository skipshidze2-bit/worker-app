import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { I18nProvider, useT } from '@/lib/i18n';
import { usePushRegistration } from '@/lib/push';
import { SessionProvider, useSession } from '@/lib/session';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <I18nProvider>
        <SessionProvider>
          <RootStack />
        </SessionProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

function RootStack() {
  const { loading, session, profile } = useSession();
  const { t } = useT();
  usePushRegistration(profile?.id);
  if (loading) return null;

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !profile}>
        <Stack.Screen name="onboarding" options={{ title: t('nav.createProfile') }} />
      </Stack.Protected>
      <Stack.Protected guard={profile?.role === 'worker'}>
        <Stack.Screen name="(worker)" options={{ headerShown: false }} />
        <Stack.Screen name="booking/[id]" options={{ title: t('nav.yourShift') }} />
      </Stack.Protected>
      <Stack.Protected guard={profile?.role === 'employer'}>
        <Stack.Screen name="(employer)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={profile?.role === 'admin'}>
        <Stack.Screen name="admin" options={{ title: 'Admin' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!profile}>
        <Stack.Screen name="shift/[id]" options={{ title: t('nav.shift') }} />
        <Stack.Screen name="chat/[bookingId]" options={{ title: t('common.chat') }} />
        <Stack.Screen name="payments" options={{ title: t('nav.payments') }} />
        <Stack.Screen name="edit-profile" options={{ title: t('nav.editProfile') }} />
      </Stack.Protected>
    </Stack>
  );
}
