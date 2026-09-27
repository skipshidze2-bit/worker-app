import { Tabs } from 'expo-router/js-tabs';

import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

export default function WorkerTabs() {
  const theme = useTheme();
  const { t } = useT();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: theme.tint, tabBarIconStyle: { display: 'none' } }}>
      <Tabs.Screen name="index" options={{ title: t('nav.findShifts') }} />
      <Tabs.Screen name="my-shifts" options={{ title: t('nav.myShifts') }} />
      <Tabs.Screen name="earnings" options={{ title: t('nav.earnings') }} />
      <Tabs.Screen name="profile" options={{ title: t('nav.profile') }} />
    </Tabs>
  );
}
