import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { registerDevice, unregisterDevice } from '@artist/api-client';

/**
 * The phone's side of push: permission, the Expo token, and telling the API
 * which install to ring.
 *
 * No skill covers this; it is written from the expo-notifications 57 docs and
 * type definitions. Remote push needs a development build — Expo Go cannot
 * receive one for this project, whose id is the one tokens are minted under.
 */

/**
 * A notification arriving while the app is open still shows as a banner.
 * Without a handler iOS drops it silently, and someone looking at the hub
 * would never learn they had just been mentioned.
 */
Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      // The API sends no badge count, so there is nothing to set.
      shouldSetBadge: false,
    }),
});

/**
 * What the person has said about notifications.
 *
 * - `granted`: allowed, including iOS's quiet "provisional" delivery.
 * - `undetermined`: never asked — the app may show the system prompt.
 * - `denied`: refused. iOS will not ask twice; only Settings can change it.
 */
export type PushPermission = 'granted' | 'undetermined' | 'denied';

function interpret(
  settings: Notifications.NotificationPermissionsStatus,
): PushPermission {
  if (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return 'granted';
  }
  return settings.canAskAgain ? 'undetermined' : 'denied';
}

/** Reads the current answer without prompting. */
export async function readPushPermission(): Promise<PushPermission> {
  return interpret(await Notifications.getPermissionsAsync());
}

/**
 * Shows the system prompt. Only ever called from a button the person pressed,
 * never on launch: iOS asks exactly once, and a cold prompt before the app has
 * shown what it would notify about is the one most often refused.
 */
export async function requestPushPermission(): Promise<PushPermission> {
  // Android 13+ shows no prompt until a channel exists. A no-op on iOS.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notifications',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  return interpret(await Notifications.requestPermissionsAsync());
}

/**
 * The token this phone last registered, so sign-out can name it.
 *
 * Asking Expo again at sign-out would also work, but it is a network round
 * trip in the one moment the person is waiting to leave, and it can fail
 * offline. A push token is an address, not a secret, hence AsyncStorage.
 */
const TOKEN_KEY = 'artist.pushToken';

/**
 * Tells the API to ring this phone. Called on every launch with permission,
 * not only the first: it is idempotent server-side, it keeps `lastSeenAt`
 * fresh, and it picks up a token Expo rotated while the app was closed.
 *
 * The project id is passed explicitly, as Expo recommends, so tokens stay tied
 * to this project rather than to whatever the build infers.
 */
export async function registerThisDevice(): Promise<void> {
  const projectId: unknown =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (typeof projectId !== 'string') {
    throw new Error('No EAS project id in app.json, so no push token.');
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  await registerDevice({
    token,
    platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
  });
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

/** How long sign-out waits on the API before leaving anyway. */
const UNREGISTER_TIMEOUT_MS = 3_000;

/**
 * Stops this phone ringing for the account that is signing out. Must run
 * *before* the session is dropped — the API only deletes the caller's own
 * tokens, so it needs to know who is calling.
 *
 * Best effort, and bounded: sign-out must work offline. A token left behind is
 * not a lasting leak, because whoever signs in next re-registers the same
 * token and the API removes every other account's row for it.
 */
export async function forgetThisDevice(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await AsyncStorage.removeItem(TOKEN_KEY);
    await Promise.race([
      unregisterDevice(token),
      new Promise((resolve) => setTimeout(resolve, UNREGISTER_TIMEOUT_MS)),
    ]);
  } catch {
    // Offline, or the API is down: see above — the next sign-in cleans up.
  }
}
