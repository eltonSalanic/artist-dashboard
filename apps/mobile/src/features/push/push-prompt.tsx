import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { spacing } from '@/theme';
import { usePushPermission, usePushPromptDismissed } from './use-push';

/** What a band can notify about — the four categories in NOTIFICATION_CATEGORY_COPY. */
const WHAT = 'mentions, tasks handed to you, schedule changes and reminders';

/**
 * The ask, at the top of the Inbox.
 *
 * iOS shows its permission prompt once per install, and a cold one on first
 * launch — before the app has shown anything worth hearing about — is the one
 * people refuse. So the app never asks unprompted: this card says what would
 * arrive, and the system prompt appears only behind "Turn on". The Inbox is
 * where it lives because a mention is the clearest case for a buzz.
 *
 * Gone once answered either way, or waved off; the You tab keeps the switch.
 */
export function PushPrompt() {
  const { permission, ask } = usePushPermission();
  const { dismissed, dismiss } = usePushPromptDismissed();
  const [asking, setAsking] = useState(false);

  if (permission !== 'undetermined' || dismissed !== false) return null;

  return (
    <Card style={styles.card}>
      <ThemedText variant="headline">Hear about it as it happens</ThemedText>
      <ThemedText variant="subhead" tone="muted">
        Turn on notifications to hear about {WHAT}.
      </ThemedText>
      <View style={styles.actions}>
        <Button
          title="Turn on"
          size="sm"
          loading={asking}
          onPress={() => {
            setAsking(true);
            void ask().finally(() => setAsking(false));
          }}
        />
        <Button title="Not now" size="sm" variant="ghost" onPress={dismiss} />
      </View>
    </Card>
  );
}

/**
 * The standing switch, on the You tab. Says what state this phone is in and
 * offers the one thing that changes it — the system prompt if it has never
 * been shown, Settings if it was refused (iOS will not prompt twice).
 */
export function PushSetting() {
  const { permission, ask } = usePushPermission();
  const [asking, setAsking] = useState(false);

  if (permission === undefined) return null;

  return (
    <Card>
      <ThemedText variant="headline">
        {permission === 'granted' ? 'Notifications are on' : 'Notifications are off'}
      </ThemedText>
      <ThemedText variant="subhead" tone="muted">
        {permission === 'granted'
          ? `This phone hears about ${WHAT}. Each band's Settings decides which.`
          : permission === 'denied'
            ? 'They were turned off for this app. Switch them back on in Settings.'
            : `Turn them on to hear about ${WHAT}.`}
      </ThemedText>
      {permission === 'undetermined' && (
        <Button
          title="Turn on"
          size="sm"
          loading={asking}
          style={styles.action}
          onPress={() => {
            setAsking(true);
            void ask().finally(() => setAsking(false));
          }}
        />
      )}
      {permission === 'denied' && (
        <Button
          title="Open Settings"
          size="sm"
          variant="secondary"
          style={styles.action}
          onPress={() => void Linking.openSettings()}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  action: { alignSelf: 'flex-start', marginTop: spacing.xs },
});
