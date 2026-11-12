import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import {
  ApiError,
  notify,
  toUserMessage,
  useDeleteAccount,
  useMySubscription,
} from '@artist/api-client';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { forgetGoogleAccount } from '@/features/auth/social-sign-in';
import { forgetThisDeviceLocally } from '@/features/push/push';
import { auth } from '@/lib/auth';
import { spacing, usePosterCanvas, useTokens } from '@/theme';

/** What the person types to unlock the button. */
const CONFIRM_WORD = 'DELETE';

/** Where each store lets you cancel a subscription. We can't cancel it for you. */
const STORE_SUBSCRIPTIONS = {
  APP_STORE: { name: 'App Store', url: 'https://apps.apple.com/account/subscriptions' },
  PLAY_STORE: {
    name: 'Google Play',
    url: 'https://play.google.com/store/account/subscriptions?package=com.bandwall.app',
  },
} as const;

/**
 * Deleting your account, for good (App Store guideline 5.1.1(v)).
 *
 * Says what goes and what stays, then asks for DELETE typed out so a stray tap
 * can't do it. A band you own with other people in it stops the deletion: the
 * API answers with those bands, and they're listed here with a way into each
 * one's Settings to hand it over or delete it. A store subscription carries on
 * billing until it's cancelled in the store, so that's said, with a link, when
 * the account has one that renews.
 */
export function DeleteAccountScreen() {
  const canvas = usePosterCanvas();
  const tokens = useTokens();
  const subscription = useMySubscription();
  const deleteAccount = useDeleteAccount();
  const [typed, setTyped] = useState('');
  const [blocking, setBlocking] = useState<{ id: string; name: string }[]>([]);

  const store =
    subscription.data?.willRenew && subscription.data.store
      ? STORE_SUBSCRIPTIONS[subscription.data.store as keyof typeof STORE_SUBSCRIPTIONS]
      : undefined;
  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD;

  const onDelete = () =>
    deleteAccount.mutate(undefined, {
      onSuccess: async () => {
        // The account and its session are gone on the server; this only
        // clears what the phone remembers. Signing out lands on the welcome
        // screen, so the confirmation is said over it.
        await Promise.all([forgetThisDeviceLocally(), forgetGoogleAccount()]);
        await auth.signOut();
        Alert.alert('Your account was deleted.');
      },
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'OWNS_SHARED_BANDS') {
          setBlocking(error.boards);
          return;
        }
        notify.error(toUserMessage(error, "Couldn't delete your account. Try again."));
      },
    });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: canvas.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl }}
    >
      <View style={{ gap: spacing.sm }}>
        <PosterText variant="statement" color={canvas.ink} accessibilityRole="header">
          Delete your account?
        </PosterText>
        <PosterText variant="body" color={canvas.soft}>
          Your account and every band only you are in are deleted for good. This can’t be
          undone.
        </PosterText>
        <PosterText variant="body" color={canvas.soft}>
          In bands you share, what you added stays for the rest of the band, shown as made by
          a former member.
        </PosterText>
      </View>

      {blocking.length > 0 && (
        <Section title="HAND THESE OVER FIRST">
          <PosterText variant="body" color={canvas.soft}>
            You own {blocking.length === 1 ? 'a band' : 'bands'} other people are in. In its
            Settings, hand it to another member, or delete it, then come back.
          </PosterText>
          {blocking.map((band) => (
            <Pressable
              key={band.id}
              accessibilityRole="button"
              accessibilityHint="Opens the band's settings"
              onPress={() => router.push(`/board/${band.id}/settings`)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md - 4,
                minHeight: 52,
                paddingVertical: spacing.sm,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <PosterText variant="rowTitle" color={canvas.ink} style={{ flex: 1 }} numberOfLines={2}>
                {band.name}
              </PosterText>
              <Icon name={{ sf: 'chevron.right', md: 'chevron-right' }} size={13} color={canvas.soft} />
            </Pressable>
          ))}
        </Section>
      )}

      {store && (
        <Section title="YOUR SUBSCRIPTION">
          <PosterText variant="body" color={canvas.soft}>
            {`It renews through ${store.name}, and deleting your account doesn't stop it. Cancel it in ${store.name} first.`}
          </PosterText>
          <Button
            title={`Manage in ${store.name}`}
            variant="secondary"
            onPress={() => void Linking.openURL(store.url)}
          />
        </Section>
      )}

      <View style={{ gap: spacing.md }}>
        <TextField
          label={`Type ${CONFIRM_WORD} to confirm`}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="done"
          placeholder={CONFIRM_WORD}
        />
        <Button
          title="Delete account"
          variant="destructive"
          disabled={!confirmed}
          loading={deleteAccount.isPending}
          onPress={onDelete}
        />
        {!store && (
          <PosterText variant="cardMeta" color={tokens.mutedForeground}>
            Paid through the App Store or Google Play? Deleting your account doesn’t cancel
            that. Cancel it in the store’s subscription settings.
          </PosterText>
        )}
      </View>
    </ScrollView>
  );
}
