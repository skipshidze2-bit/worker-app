import { Alert, Platform } from 'react-native';

/** Cross-platform yes/no confirmation. */
export function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'No', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Yes', onPress: () => resolve(true) },
    ]),
  );
}
