import { Alert, Platform } from 'react-native';

// Button labels follow the app language; set by I18nProvider.
let labels = { yes: 'კი', no: 'არა' };
export function setConfirmLabels(next: { yes: string; no: string }) {
  labels = next;
}

/** Cross-platform yes/no confirmation. */
export function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: labels.no, style: 'cancel', onPress: () => resolve(false) },
      { text: labels.yes, onPress: () => resolve(true) },
    ]),
  );
}
