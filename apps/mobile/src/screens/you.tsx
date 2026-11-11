import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { toUserMessage, useMe } from '@artist/api-client';
import { ROLE_LABELS } from '@artist/shared';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { Section } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { useSelectedBoard } from '@/features/board/selected-board';
import { MascotSetting } from '@/features/mascot/mascot-setting';
import { PushSetting } from '@/features/push/push-prompt';
import { forgetThisDevice } from '@/features/push/push';
import { auth } from '@/lib/auth';
import { forgetGoogleAccount } from '@/features/auth/social-sign-in';
import { feedbackAvailable, showFeedback } from '@/lib/sentry';
import {
  boardAccent,
  posterRadius,
  spacing,
  usePosterCanvas,
  useScheme,
  useShadows,
} from '@/theme';

const centred = { textAlign: 'center' } as const;

/**
 * The account tab: who you are signed in as, which band the app is currently
 * showing, and the way out.
 *
 * This started life as P5's proof that the whole chain works — keychain
 * session, injected token, `@artist/api-client` under Metro, the phone's route
 * to the API — and it still is. It also holds this phone's notification
 * switch; which categories each band sends lives in that band's Settings.
 *
 * Set like a Spotify profile: your initial in a large round tile, your name
 * as big as the widget page sets the band's.
 */
export function YouScreen() {
  const canvas = usePosterCanvas();
  const shadows = useShadows();
  const scheme = useScheme();
  const me = useMe(true);
  const { board, boards } = useSelectedBoard();
  const [signingOut, setSigningOut] = useState(false);
  // The avatar wears the band you are looking at, so it changes with it.
  const accent = board ? boardAccent(board.palette, scheme) : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: canvas.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl }}
    >
      {me.isPending ? (
        <View style={{ gap: spacing.md, alignItems: 'center' }}>
          <Skeleton width={88} height={88} style={{ borderRadius: 44, alignSelf: 'center' }} />
          <Skeleton width="60%" height={36} />
          <Skeleton width="45%" height={14} />
        </View>
      ) : me.isError ? (
        <View style={{ gap: spacing.sm, alignItems: 'center' }}>
          <PosterText variant="title" color={canvas.ink} style={centred}>
            Could not load your account
          </PosterText>
          <PosterText variant="body" color={canvas.soft} style={centred}>
            {toUserMessage(me.error)}
          </PosterText>
          <Button
            title="Try again"
            variant="ghost"
            size="sm"
            onPress={() => void me.refetch()}
            style={{ paddingHorizontal: 0 }}
          />
        </View>
      ) : (
        <View accessible accessibilityRole="header" style={{ gap: spacing.md, alignItems: 'center' }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: accent?.bg ?? canvas.ink,
              boxShadow: shadows.raised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PosterText variant="display" color={accent?.fg ?? canvas.background}>
              {me.data.user.displayName.trim().charAt(0).toUpperCase() || '?'}
            </PosterText>
          </View>
          <View style={{ gap: 2, alignSelf: 'stretch' }}>
            <PosterText
              variant="display"
              color={canvas.ink}
              style={centred}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {me.data.user.displayName}
            </PosterText>
            <PosterText variant="body" color={canvas.soft} numberOfLines={1} style={centred}>
              {me.data.user.email}
            </PosterText>
          </View>
        </View>
      )}

      {board !== null && accent !== null && (
        <Section title="SHOWING">
          {/* The band is the switcher, as the band name is on the widget page.
              Pushed from `onPress` rather than wrapped in a `Link asChild`: the
              Link's slot drops a style function, and with it the block's fill. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${board.name}, ${ROLE_LABELS[board.role].toLowerCase()}. Change band`}
            onPress={() => router.push('/boards')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md - 4,
              padding: spacing.md - 2,
              borderRadius: posterRadius.block,
              borderCurve: 'continuous',
              backgroundColor: accent.bg,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <View style={{ flex: 1, gap: spacing.xs }}>
              <PosterText variant="title" color={accent.fg} numberOfLines={2}>
                {board.name}
              </PosterText>
              <PosterText variant="label" color={accent.fg}>
                {/* "Member", as the help calls it, not the stored USER. */}
                {boards.length > 1
                  ? `${ROLE_LABELS[board.role].toUpperCase()} · ${boards.length} BANDS · TAP TO SWITCH`
                  : ROLE_LABELS[board.role].toUpperCase()}
              </PosterText>
            </View>
            <Icon name={{ sf: 'chevron.down', md: 'expand-more' }} size={14} color={accent.fg} />
          </Pressable>
        </Section>
      )}

      <Section title="THIS PHONE">
        <PushSetting />
      </Section>

      <Section title="MASCOT">
        <MascotSetting />
      </Section>

      <Section title="HELP">
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Roles, the books, show statuses and the wall, explained"
          onPress={() => router.push('/help')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md - 4,
            minHeight: 52,
            paddingVertical: spacing.sm,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon name={{ sf: 'questionmark.circle', md: 'help-outline' }} size={22} color={canvas.ink} />
          <View style={{ flex: 1, gap: 2 }}>
            <PosterText variant="rowTitle" color={canvas.ink}>
              How Band Wall works
            </PosterText>
            <PosterText variant="cardMeta" color={canvas.soft}>
              Who can do what, how the books work, and the rest
            </PosterText>
          </View>
          <Icon name={{ sf: 'chevron.right', md: 'chevron-right' }} size={13} color={canvas.soft} />
        </Pressable>
      </Section>

      {/* Sentry's feedback form, linked to the errors just before it. Only
          shown when reporting is on, so there's always somewhere it goes. */}
      {feedbackAvailable && (
        <Button title="Report a problem" variant="secondary" onPress={showFeedback} />
      )}

      <Button
        title="Sign out"
        variant="destructive"
        loading={signingOut}
        onPress={() => {
          setSigningOut(true);
          // Unregistered first, while the session can still say whose
          // token it is — otherwise the next person to sign in on this
          // phone would be buzzed for this account until they did.
          void forgetThisDevice()
            .then(() => Promise.all([auth.signOut(), forgetGoogleAccount()]))
            .finally(() => setSigningOut(false));
        }}
      />
    </ScrollView>
  );
}
