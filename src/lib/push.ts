import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Saves this device's push token so the server can send shift updates and reminders. */
export function usePushRegistration(userId: string | undefined) {
  useEffect(() => {
    if (!userId || Platform.OS === 'web' || !Device.isDevice) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return; // push needs an EAS project id (run `eas init`)

    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Shifts',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      await supabase.from('private_profiles').update({ expo_push_token: token }).eq('id', userId);
    })().catch((e) => console.warn('push registration failed', e));
  }, [userId]);
}
