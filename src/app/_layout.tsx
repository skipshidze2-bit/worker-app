import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { PaymentsProvider } from '@/lib/payments';
import { usePushRegistration } from '@/lib/push';
import { SessionProvider, useSession } from '@/lib/session';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SessionProvider>
        <PaymentsProvider>
          <RootStack />
        </PaymentsProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

function RootStack() {
  const { loading, session, profile } = useSession();
  usePushRegistration(profile?.id);
  if (loading) return null;

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !profile}>
        <Stack.Screen name="onboarding" options={{ title: 'Create your profile' }} />
      </Stack.Protected>
      <Stack.Protected guard={profile?.role === 'worker'}>
        <Stack.Screen name="(worker)" options={{ headerShown: false }} />
        <Stack.Screen name="booking/[id]" options={{ title: 'Your shift' }} />
      </Stack.Protected>
      <Stack.Protected guard={profile?.role === 'employer'}>
        <Stack.Screen name="(employer)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={profile?.role === 'admin'}>
        <Stack.Screen name="admin" options={{ title: 'Admin' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!profile}>
        <Stack.Screen name="shift/[id]" options={{ title: 'Shift' }} />
        <Stack.Screen name="chat/[bookingId]" options={{ title: 'Chat' }} />
        <Stack.Screen name="payments" options={{ title: 'Payments' }} />
        <Stack.Screen name="edit-profile" options={{ title: 'Edit profile' }} />
      </Stack.Protected>
    </Stack>
  );
}
