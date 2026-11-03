import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useCreateBoard,
  useMe,
  usePurchaseConfirmation,
  useRefreshSubscription,
} from '@artist/api-client';
import { BOARD_PALETTES, BoardPalettes, type BoardPalette } from '@artist/shared';
import { Button } from '@/components/button';
import { MyMascot } from '@/components/mascot';
import { PosterText } from '@/components/poster-text';
import { TextField } from '@/components/text-field';
import { useSelectedBoard } from '@/features/board/selected-board';
import { billingAvailable, showPaywall } from '@/features/billing/purchases';
import {
  clearBandDraft,
  loadBandDraft,
  onboardingIntent,
  saveBandDraft,
  setOnboardingIntent,
} from '@/features/onboarding/onboarding-state';
import { StepProgress } from '@/features/onboarding/step-progress';
import { reportError } from '@/lib/report-error';
import { concentric, posterRadius, posterSlot, spacing, usePosterCanvas, useScheme } from '@/theme';

/**
 * Step 2 of 3 for someone starting a band, and what anyone in no band sees:
 * name the band and pick its colour, with its block on the wall drawn as you
 * type. Continue opens the RevenueCat paywall when a subscription is needed,
 * and the band is created once the purchase is confirmed, then "You're live".
 *
 * Nothing reaches the API until then (it only creates a band for a subscriber),
 * so the name and colour are kept on the phone: closing the paywall, or the
 * app, leaves them filled in for next time.
 */
export function StartBandScreen() {
  const canvas = usePosterCanvas();
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const me = useMe(true);
  const userId = me.data?.user.id ?? '';
  const { select } = useSelectedBoard();
  const create = useCreateBoard();
  const refresh = useRefreshSubscription();
  const { subscription, awaiting, stuck, confirm } = usePurchaseConfirmation();
  const [name, setName] = useState('');
  const [palette, setPalette] = useState<BoardPalette>('playful');
  const [busy, setBusy] = useState(false);
  // Bought in order to create this band: create it once the API agrees.
  const [creating, setCreating] = useState(false);
  const started = useRef(false);
  // Read once: the step count belongs to the first visit straight after signing up.
  const [signingUp] = useState(() => onboardingIntent() === 'signup');

  useEffect(() => {
    void loadBandDraft().then((draft) => {
      if (!draft) return;
      setName((current) => current || draft.name);
      setPalette(draft.palette);
    });
  }, []);

  const block = posterSlot(palette, scheme, 'c1');
  const trimmed = name.trim();

  const make = async () => {
    try {
      const board = await create.mutateAsync({ name: trimmed, palette });
      clearBandDraft();
      setOnboardingIntent(null);
      select(board.id);
      router.push(`/band-live?boardId=${board.id}`);
    } catch {
      // The hook has already said why; the name stays for another go.
      started.current = false;
    } finally {
      setCreating(false);
    }
  };

  const isPro = subscription.data?.isPro ?? false;
  const makeOnce = useEffectEvent(() => void refresh().then(make));
  useEffect(() => {
    if (!creating || !isPro || started.current) return;
    started.current = true;
    makeOnce();
  }, [creating, isPro]);

  const next = async () => {
    if (!trimmed || busy) return;
    saveBandDraft({ name: trimmed, palette });
    const createBlock = subscription.data?.createBlock ?? null;

    if (createBlock === 'ALREADY_OWNS_BAND') {
      Alert.alert(
        "You've already got a band",
        'A subscription covers one band. Delete yours in its settings and you can start a new one.',
      );
      return;
    }
    if (createBlock !== 'NO_SUBSCRIPTION') {
      setBusy(true);
      await make();
      setBusy(false);
      return;
    }
    if (!billingAvailable()) {
      Alert.alert('Subscribe on the web', 'Start your free month on Band Wall on the web, then come back here.');
      return;
    }

    setBusy(true);
    try {
      const outcome = await showPaywall(userId);
      if (outcome === 'subscribed') {
        confirm();
        setCreating(true);
      } else if (outcome === 'unavailable') {
        Alert.alert("Plans didn't load", 'Check your connection and try again.');
      }
      // Closed: stay here with the name kept.
    } catch (error) {
      reportError(error, { where: 'startBand.paywall' });
      Alert.alert("That didn't work", 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const working = busy || creating || create.isPending;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: canvas.background }}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxl + spacing.xl },
        ]}
      >
        {signingUp && <StepProgress step={2} of={3} />}
        <MyMascot pose="hero" width={200} style={{ alignSelf: 'center' }} />
        <View accessible accessibilityRole="header" style={{ gap: spacing.xs }}>
          <PosterText variant="label" color={canvas.soft} style={styles.centred}>
            {"NEW BAND · YOU'LL OWN IT"}
          </PosterText>
          <PosterText variant="display" color={canvas.ink} style={styles.centred}>
            Name Your Band.
          </PosterText>
        </View>

        <TextField
          label="Band name"
          value={name}
          onChangeText={setName}
          editable={!working}
          placeholder="The Midnight Owls"
          autoCapitalize="words"
          maxLength={80}
          returnKeyType="done"
          doneBar={false}
        />

        <View style={{ gap: spacing.sm }}>
          <PosterText variant="label" color={canvas.soft}>
            PICK ITS COLOUR
          </PosterText>
          <View accessibilityRole="radiogroup" style={styles.swatches}>
            {BoardPalettes.map((id) => {
              const swatch = posterSlot(id, scheme, 'c1');
              const selected = id === palette;
              const label = BOARD_PALETTES.find((p) => p.id === id)?.label ?? id;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  disabled={working}
                  hitSlop={6}
                  onPress={() => setPalette(id)}
                  style={[
                    styles.swatch,
                    { backgroundColor: swatch.bg },
                    selected && { borderWidth: 3, borderColor: canvas.ink },
                  ]}
                />
              );
            })}
          </View>
        </View>

        <View
          accessible
          accessibilityLabel={`Preview: ${trimmed || 'your band'} on the wall`}
          style={[styles.preview, { backgroundColor: block.bg }]}
        >
          <PosterText variant="label" color={block.soft}>
            OWNER · YOU
          </PosterText>
          <PosterText variant="statement" color={block.ink} numberOfLines={2}>
            {trimmed || 'Your band'}
          </PosterText>
          <View style={styles.cards}>
            {(['c2', 'c3', 'c4', 'base'] as const).map((slot) => (
              <View
                key={slot}
                style={[styles.card, { backgroundColor: posterSlot(palette, scheme, slot).bg }]}
              />
            ))}
          </View>
        </View>

        {awaiting && !stuck && (
          <PosterText variant="body" color={canvas.soft} style={styles.centred}>
            Confirming your free month…
          </PosterText>
        )}
        {stuck && (
          <View style={{ gap: spacing.sm }}>
            <PosterText variant="body" color={canvas.soft} style={styles.centred}>
              {"We can't confirm your purchase yet. If you bought it, you're covered, so there's no need to buy again."}
            </PosterText>
            <Button title="Try again" variant="secondary" onPress={confirm} />
          </View>
        )}

        <Button
          title="Continue"
          loading={working && !stuck}
          disabled={!trimmed || working}
          onPress={() => void next()}
        />

        <PosterText variant="body" color={canvas.soft} style={styles.centred}>
          {`Joining a band instead? Ask one of its admins to invite ${me.data?.user.email ?? 'you'}.`}
        </PosterText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The preview's cards: a hub card's corner, scaled down with the card. */
const CARD_RADIUS = posterRadius.block - 4;

const styles = StyleSheet.create({
  // The form sits in the middle of a tall phone rather than under the status bar.
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, gap: spacing.lg },
  centred: { textAlign: 'center' },
  swatches: { flexDirection: 'row', gap: spacing.md - 4 },
  swatch: { width: 40, height: 40, borderRadius: 20 },
  preview: {
    // Concentric with the little cards sitting in its bottom corners.
    borderRadius: concentric(CARD_RADIUS, spacing.md),
    borderCurve: 'continuous',
    padding: spacing.md,
    gap: spacing.xs,
  },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  card: {
    width: '48%',
    flexGrow: 1,
    height: 40,
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
  },
});
