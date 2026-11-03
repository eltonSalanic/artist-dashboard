import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMe, useMySubscription, useSendInvite } from '@artist/api-client';
import { MASCOT_WIDTH, MyMascot, PhraseLettering } from '@/components/mascot';
import { PosterText } from '@/components/poster-text';
import { TextInput } from '@/components/text-input';
import { INK_BUTTON_HEIGHT, InkButton } from '@/features/onboarding/ink-button';
import { concentric, posterInput, posterRadius, posterSlot, spacing, useScheme } from '@/theme';

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
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        <View style={styles.middle}>
          {/* The mascot says "you're live" in its own hand, in place of the kicker. */}
          <View style={styles.mascot}>
            <PhraseLettering phrase="youAreLive" label="You're live" on={block.bg} />
            <MyMascot pose="celebrateBare" width={MASCOT_WIDTH} on={block.bg} />
          </View>
          <View accessible accessibilityRole="header" style={{ gap: spacing.sm }}>
            <PosterText variant="display" color={block.ink} style={styles.centred}>
              {`${band?.name ?? 'Your band'}\nIs Open.`}
            </PosterText>
            <PosterText variant="body" color={block.ink} style={styles.centred}>
              {freeUntil
                ? `Free until ${freeUntil}. Bring the band in: they join free.`
                : 'Bring the band in: they join free.'}
            </PosterText>
          </View>

          <View style={[styles.inviteBlock, { backgroundColor: block.ink + '1A' }]}>
            <PosterText variant="label" color={block.soft}>
              INVITE A BANDMATE
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
          title="Go to my wall"
          ink={block.ink}
          bg={block.bg}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, gap: spacing.lg },
  // Fills the room above the button and sits the message and invite just above its middle.
  middle: { flex: 1, justifyContent: 'center', gap: spacing.lg, paddingBottom: spacing.xl },
  mascot: { alignSelf: 'center', alignItems: 'center', gap: spacing.md },
  centred: { textAlign: 'center' },
  inviteBlock: {
    // Concentric with the Send invite capsule sitting in its bottom corners.
    borderRadius: concentric(INK_BUTTON_HEIGHT / 2, spacing.md),
    borderCurve: 'continuous',
    padding: spacing.md,
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: posterRadius.block,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
});
