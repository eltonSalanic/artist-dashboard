import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMe, useMySubscription, useSendInvite } from '@artist/api-client';
import { MyMascot, PhraseLettering } from '@/components/mascot';
import { PosterText } from '@/components/poster-text';
import { TextInput } from '@/components/text-input';
import { InkButton } from '@/features/onboarding/ink-button';
import { concentric, posterInput, posterSlot, radius, spacing, useScheme } from '@/theme';

/**
 * "You're live": the moment a new band opens, painted in its own colour. Says
 * when the free month ends, and puts inviting bandmates one field away,
 * since a band wall with one person on it isn't much of a wall yet.
 */
export function BandLiveScreen({ boardId }: { boardId: string }) {
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const me = useMe(true);
  const band = me.data?.boards.find((b) => b.id === boardId);
  const sub = useMySubscription().data;
  const invite = useSendInvite(boardId);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string[]>([]);
  const block = posterSlot(band?.palette ?? 'playful', scheme, 'c1');

  const freeUntil =
    sub?.isTrial && sub.currentPeriodEnd
      ? new Date(sub.currentPeriodEnd).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        })
      : null;

  const send = () => {
    const to = email.trim();
    if (!to || invite.isPending) return;
    invite.mutate(
      { email: to, role: 'USER' },
      {
        onSuccess: () => {
          setSent((list) => [...list, to]);
          setEmail('');
        },
      },
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: block.bg }}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <View style={styles.middle}>
          {/* The mascot says you're in in its own hand, in place of the kicker. */}
          <View style={styles.mascot}>
            <PhraseLettering phrase="youreIn" label="You're in" on={block.bg} />
            <MyMascot pose="celebrateBare" width={150} on={block.bg} />
          </View>
          <View accessible accessibilityRole="header" style={{ gap: spacing.sm }}>
            <PosterText variant="display" color={block.ink} style={styles.centred}>
              {band?.name ?? 'Your band'}
            </PosterText>
            {freeUntil && (
              <PosterText variant="body" color={block.ink} style={styles.centred}>
                {`Free until ${freeUntil}.`}
              </PosterText>
            )}
          </View>

          <View style={[styles.inviteBlock, { backgroundColor: block.ink + '1A' }]}>
            <PosterText variant="label" color={block.soft}>
              Invite your bandmate
            </PosterText>
            <TextInput
              accessibilityLabel="Bandmate's email"
              value={email}
              onChangeText={setEmail}
              placeholder="bandmate@email.com"
              placeholderTextColor={block.soft}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="send"
              onSubmitEditing={send}
              style={[posterInput, styles.input, { color: block.ink, borderColor: block.soft }]}
            />
            <InkButton
              title="Send invite"
              ink={block.ink}
              bg={block.bg}
              outline
              radius={INSET_RADIUS}
              loading={invite.isPending}
              disabled={!email.trim()}
              onPress={send}
            />
            {sent.length > 0 && (
              <PosterText variant="body" color={block.ink}>
                {`Invited ${sent.join(', ')}. They'll get an email with a code.`}
              </PosterText>
            )}
          </View>
        </View>

        <InkButton
          title="Go To My Wall"
          ink={block.ink}
          bg={block.bg}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * The invite box has the corner every card has (radius.lg); the field and the
 * Send invite button inside it share its corners' centre, so they take that
 * radius less the padding instead of being capsules.
 */
const INVITE_PADDING = spacing.sm;
const INSET_RADIUS = radius.lg - INVITE_PADDING;

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, gap: spacing.xl },
  // Fills the room above the button and sits the message and invite just above its middle.
  middle: { flex: 1, justifyContent: 'center', gap: spacing.xl, paddingBottom: spacing.xl },
  mascot: { alignSelf: 'center', alignItems: 'center', gap: spacing.md },
  centred: { textAlign: 'center' },
  inviteBlock: {
    // The app's card corner, with the field and button inside it concentric.
    borderRadius: concentric(INSET_RADIUS, INVITE_PADDING),
    borderCurve: 'continuous',
    padding: INVITE_PADDING,
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: INSET_RADIUS,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
});
