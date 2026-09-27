import { Tabs } from 'expo-router/js-tabs';

import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

export default function EmployerTabs() {
  const theme = useTheme();
  const { t } = useT();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: theme.tint, tabBarIconStyle: { display: 'none' } }}>
      <Tabs.Screen name="index" options={{ title: t('nav.myShifts') }} />
      <Tabs.Screen name="post" options={{ title: t('nav.postShift') }} />
      <Tabs.Screen name="workers" options={{ title: t('nav.myWorkers') }} />
      <Tabs.Screen name="profile" options={{ title: t('nav.account') }} />
    </Tabs>
  );
}
