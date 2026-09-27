import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import type { ReactElement } from 'react';

import { callFunction } from '@/lib/supabase';

export function PaymentsProvider({ children }: { children: ReactElement }) {
  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
      urlScheme="workerapp">
      {children}
    </StripeProvider>
  );
}

type SetupResponse = {
  customer_id: string;
  ephemeral_key: string;
  setup_intent_client_secret: string;
};

/** Employers: opens Stripe's sheet to save a card for charging shifts. Returns true when saved. */
export function useSaveCard() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  return async (): Promise<boolean> => {
    const setup = await callFunction<SetupResponse>('stripe-setup');
    const init = await initPaymentSheet({
      merchantDisplayName: 'Worker App',
      customerId: setup.customer_id,
      customerEphemeralKeySecret: setup.ephemeral_key,
      setupIntentClientSecret: setup.setup_intent_client_secret,
      returnURL: 'workerapp://payments',
    });
    if (init.error) throw new Error(init.error.message);
    const result = await presentPaymentSheet();
    if (result.error) {
      if (result.error.code === 'Canceled') return false;
      throw new Error(result.error.message);
    }
    return true;
  };
}
