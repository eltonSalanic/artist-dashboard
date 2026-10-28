import { useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useSelectedBoard } from '@/features/board/selected-board';
import {
  readPushPermission,
  registerThisDevice,
  requestPushPermission,
  type PushPermission,
} from './push';
import { pushDestination } from './push-route';
import { onTokenChange, single } from './token-changes';
import { reportError } from '@/lib/report-error';

/**
 * Notification permission, as a query.
 *
 * A query rather than state because the answer can change outside the app —
 * someone flips the switch in Settings and comes back — and the root layout
 * already maps "app became active" onto React Query's focus, so a stale read
 * refetches on return without any listener of its own here.
 */
const PERMISSION_KEY = ['push-permission'];

export function usePushPermission() {
  const queryClient = useQueryClient();
  const permission = useQuery({
    queryKey: PERMISSION_KEY,
    queryFn: readPushPermission,
    staleTime: 0,
    retry: false,
  });

  const ask = useCallback(async () => {
    const answer = await requestPushPermission();
    queryClient.setQueryData<PushPermission>(PERMISSION_KEY, answer);
    return answer;
  }, [queryClient]);

  return { permission: permission.data, ask };
}

/**
 * Whether the person waved the Inbox's "turn on notifications" card away.
 * Remembered per phone; the You tab still offers the switch afterwards.
 */
const DISMISSED_KEY = 'artist.pushPromptDismissed';
const DISMISSED_QUERY = ['push-prompt-dismissed'];

export function usePushPromptDismissed() {
  const queryClient = useQueryClient();
  const dismissed = useQuery({
    queryKey: DISMISSED_QUERY,
    queryFn: async () => (await AsyncStorage.getItem(DISMISSED_KEY)) === 'true',
    staleTime: Infinity,
  });

  const dismiss = useCallback(() => {
    queryClient.setQueryData(DISMISSED_QUERY, true);
    void AsyncStorage.setItem(DISMISSED_KEY, 'true').catch(() => {
      // Hidden for this session either way; only the memory is lost.
    });
  }, [queryClient]);

  // Undefined while reading, so the card does not flash in and out.
  return { dismissed: dismissed.data, dismiss };
}

/**
 * Responses already acted on. Module scope, so signing out and back in — which
 * remounts the tabs — cannot replay a tap the app already followed.
 */
const handled = new Set<string>();

/**
 * Everything push does while someone is signed in. Mounted once, beside the
 * tab bar, so it lives exactly as long as a session.
 */
export function usePushNotifications() {
  const queryClient = useQueryClient();
  const { boards, loading, select } = useSelectedBoard();
  const { permission } = usePushPermission();
  const granted = permission === 'granted';

  // Register whenever permission is (or becomes) granted, and again if the
  // OS hands the app a *different* device token mid-session.
  //
  // The listener must not re-register on every event: fetching a token makes
  // iOS report it again, so that loops — it flooded the API at ~50 requests a
  // second on the first device build. See token-changes.ts.
  useEffect(() => {
    if (!granted) return;
    const register = single(() =>
      registerThisDevice().catch((error: unknown) => {
        // Not alerted: the person did nothing to cause it, and the next
        // launch tries again. Reported (dev builds also log it to Metro).
        reportError(error, { where: 'pushRegistration' });
      }),
    );
    const rotated = onTokenChange(() => void register());
    void register();
    const subscription = Notifications.addPushTokenListener((token) =>
      rotated(String(token.data)),
    );
    return () => subscription.remove();
  }, [granted]);

  // A push is a sign something changed. Mentions are the one list with a tab
  // badge, so refresh them now rather than on the next 30-second poll.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      void queryClient.invalidateQueries({ queryKey: ['mentions'] });
    });
    return () => subscription.remove();
  }, [queryClient]);

  // A tap — including the one that launched the app from cold.
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    // Wait for the stored band choice: selecting before it is read would be
    // overwritten by it a moment later.
    if (loading || !response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return;
    }
    const id = response.notification.request.identifier;
    if (handled.has(id)) return;
    handled.add(id);
    Notifications.clearLastNotificationResponse();

    const destination = pushDestination(response.notification.request.content.data);
    // A band the person has since left: there is nothing there to open.
    if (!destination || !boards.some((board) => board.id === destination.boardId)) {
      return;
    }

    // The notification's band becomes the one on show, so backing out of the
    // task lands on its own hub rather than another band's.
    select(destination.boardId);
    if (destination.href) router.push(destination.href);
    else router.navigate('/');
  }, [response, loading, boards, select]);
}

/** Renders nothing; exists so the hook can sit beside the tab bar. */
export function PushNotifications() {
  usePushNotifications();
  return null;
}
