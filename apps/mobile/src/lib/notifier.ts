import { Alert } from 'react-native';
import type { Notifier } from '@artist/api-client';

/**
 * Mobile's half of the notifier the API client expects. Web wires this to
 * sonner, which has no React Native build.
 *
 * This is deliberately the crudest thing that cannot lose a message: an
 * `Alert` for failures, nothing for successes. A toast is a design-system
 * component and belongs with the rest of them in P6 — until then an alert is
 * loud and correct, where a half-built toast would be quiet and wrong.
 */
export const notifier: Notifier = {
  error: (message) => Alert.alert('Something went wrong', message),
  success: () => {
    // Success is already visible in the UI that caused it; a modal alert for
    // "Saved" would be worse than silence.
  },
};
