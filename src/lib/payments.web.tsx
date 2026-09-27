import type { ReactElement } from 'react';

// Stripe's React Native SDK has no web build; card setup happens in the mobile app.
export function PaymentsProvider({ children }: { children: ReactElement }) {
  return children;
}

export function useSaveCard() {
  return async (): Promise<boolean> => {
    throw new Error('Add your card in the mobile app.');
  };
}
