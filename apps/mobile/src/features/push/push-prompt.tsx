import { useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { Icon } from '@/components/icon';
import { PosterPill } from '@/components/poster-pill';
import { PosterText } from '@/components/poster-text';
import { blockInk, posterRadius, spacing, useCanvasInk, usePosterSlot } from '@/theme';
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
 *
 * A block in the page's own ink — black on paper, charcoal on black — rather
 * than a band's colour: it is about this phone, not about any one band.
 */
export function PushPrompt() {
  const { permission, ask } = usePushPermission();
  const { dismissed, dismiss } = usePushPromptDismissed();
  const [asking, setAsking] = useState(false);
  const ink = blockInk(usePosterSlot('base'));

  if (permission !== 'undetermined' || dismissed !== false) return null;

  return (
    <View
      style={{
        backgroundColor: ink.bg,
        borderRadius: posterRadius.block,
        borderCurve: 'continuous',
        padding: spacing.md + 2,
        gap: spacing.sm,
        marginBottom: spacing.lg,
      }}
    >
      <PosterText variant="label" color={ink.soft}>
        NOTIFICATIONS
      </PosterText>
      <PosterText variant="statement" color={ink.ink} accessibilityRole="header">
        Hear about it as it happens
      </PosterText>
      <PosterText variant="body" color={ink.soft}>
        {`Turn on notifications to hear about ${WHAT}.`}
      </PosterText>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
        <PosterPill
          ink={ink}
          filled
          label="Turn on"
          lead={asking ? <ActivityIndicator size="small" color={ink.bg} /> : undefined}
          disabled={asking}
          onPress={() => {
            setAsking(true);
            void ask().finally(() => setAsking(false));
          }}
        />
        <PosterPill ink={ink} label="Not now" onPress={dismiss} />
      </View>
    </View>
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
  const ink = useCanvasInk();

  if (permission === undefined) return null;
  const on = permission === 'granted';

  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.xs }}>
      <Icon
        name={
          on
            ? { sf: 'bell.fill', md: 'notifications' }
            : { sf: 'bell.slash', md: 'notifications-off' }
        }
        size={20}
        color={ink.ink}
      />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <PosterText variant="rowTitle" color={ink.ink}>
          {on ? 'Notifications are on' : 'Notifications are off'}
        </PosterText>
        <PosterText variant="cardMeta" color={ink.soft}>
          {on
            ? `This phone hears about ${WHAT}. Each band's Settings decides which.`
            : permission === 'denied'
              ? 'They were turned off for this app. Switch them back on in Settings.'
              : `Turn them on to hear about ${WHAT}.`}
        </PosterText>
        {permission === 'undetermined' && (
          <View style={{ marginTop: spacing.xs }}>
            <PosterPill
              ink={ink}
              filled
              label="Turn on"
              lead={asking ? <ActivityIndicator size="small" color={ink.bg} /> : undefined}
              disabled={asking}
              onPress={() => {
                setAsking(true);
                void ask().finally(() => setAsking(false));
              }}
            />
          </View>
        )}
        {permission === 'denied' && (
          <View style={{ marginTop: spacing.xs }}>
            <PosterPill
              ink={ink}
              label="Open Settings"
              onPress={() => void Linking.openSettings()}
            />
          </View>
        )}
      </View>
    </View>
  );
}
