import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BAND_WALL_PLAN, type BoardSubscriptionDto } from '@artist/shared';
import {
  useBoardSubscription,
  useMe,
  usePurchaseConfirmation,
  useRefreshSubscription,
} from '@artist/api-client';
import { Button } from '@/components/button';
import { MASCOT_WIDTH, MyMascot } from '@/components/mascot';
import { ThemedText } from '@/components/themed-text';
import {
  billingAvailable,
  manageSubscription,
  restoreSubscription,
  showPaywall,
} from '@/features/billing/purchases';
import { reportError } from '@/lib/report-error';
import { spacing } from '@/theme';

const centred = { textAlign: 'center' } as const;

/**
 * The locked band's gate, drawn in the hub where its widgets would be, so the
 * band masthead above it still switches bands the way it always does.
 *
 * The sad mascot, one line saying what happened, and for the owner one button
 * that fixes it: Renew opens RevenueCat's paywall (or the store's subscription
 * management while a payment is being retried). Switch band sits under it when
 * there is another band to switch to, and the small print (restore purchases,
 * privacy, terms) runs along one line below. Everyone else is told it's the
 * owner's call.
 *
 * Buying is confirmed the way the subscription screen does it: the store
 * answers before RevenueCat's webhook reaches the API, so after a purchase this
 * polls until the API agrees, then refreshes `/me`, which puts the wall back.
 */
export function SubscriptionGate({ boardId, name }: { boardId: string; name: string }) {
  const board = useBoardSubscription(boardId);
  const { boards } = useMe(true).data ?? { boards: [] };
  const switchBand = boards.length > 1 ? () => router.push('/boards') : undefined;

  // Nothing until the API says whose call this is, so the member line never
  // flashes for the owner.
  if (!board.data) return <View style={{ flex: 1 }} />;
  return board.data.isOwner ? (
    <OwnerGate boardId={boardId} status={board.data.status} switchBand={switchBand} />
  ) : (
    <MemberGate name={name} owner={board.data.ownerName} switchBand={switchBand} />
  );
}

function Gate({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.lg }}>
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <MyMascot pose="sad" width={MASCOT_WIDTH} />
        <ThemedText variant="largeTitle" style={centred} accessibilityRole="header">
          {title}
        </ThemedText>
        {body !== undefined && (
          <ThemedText variant="subhead" tone="muted" style={centred}>
            {body}
          </ThemedText>
        )}
      </View>
      {children}
    </View>
  );
}

/** What the owner is told, and what the one button does, by where the subscription stands. */
function ownerCopy(status: BoardSubscriptionDto['status']): {
  title: string;
  /** The line under the title: what gets the wall back. */
  body: string;
  action: string;
} {
  switch (status) {
    case 'GRACE':
      return {
        title: "Your Band Wall payment didn't go through",
        body: 'Sort out the payment and the wall opens right back up for everyone in the band.',
        action: 'Fix payment',
      };
    case 'EXPIRED':
    case 'CANCELLED':
      return {
        title: 'Your Band Wall subscription ended',
        body: 'Subscribe again and the wall opens right back up, with everything still on it.',
        action: 'Renew subscription',
      };
    case 'ACTIVE':
    case null:
    default:
      return {
        title: 'Your band needs a Band Wall subscription',
        body: 'Your subscription is what keeps the wall open for everyone in the band.',
        action: 'Subscribe to Band Wall',
      };
  }
}

function OwnerGate({
  boardId,
  status,
  switchBand,
}: {
  boardId: string;
  status: BoardSubscriptionDto['status'];
  switchBand?: () => void;
}) {
  const me = useMe(true);
  const userId = me.data?.user.id ?? '';
  const [busy, setBusy] = useState<'paywall' | 'restore' | null>(null);
  const announced = useRef(false);
  const { subscription, purchased, awaiting, stuck, confirm } = usePurchaseConfirmation();
  const refresh = useRefreshSubscription();
  const isPro = subscription.data?.isPro ?? false;
  const canBuy = billingAvailable();
  const { title, body, action } = ownerCopy(status);

  useEffect(() => {
    if (!purchased || !isPro || announced.current) return;
    announced.current = true;
    void refresh();
  }, [purchased, isPro, refresh]);

  const run = async (key: 'paywall' | 'restore', task: () => Promise<boolean>) => {
    setBusy(key);
    try {
      if (await task()) {
        announced.current = false;
        confirm();
      }
    } catch (error) {
      reportError(error, { where: `subscriptionGate.${key}` });
      Alert.alert("That didn't work", 'Try again in a moment.');
    } finally {
      setBusy(null);
    }
  };

  const renew = () =>
    run('paywall', async () => {
      if (status === 'GRACE') {
        // The store is retrying the card: the fix is there, not a new purchase.
        await manageSubscription(userId);
        return false;
      }
      const outcome = await showPaywall(userId);
      // The paywall couldn't load: the full subscription screen lists the plans itself.
      if (outcome === 'unavailable') router.push(`/board/${boardId}/subscribe`);
      return outcome === 'subscribed';
    });

  const restore = () =>
    run('restore', async () => {
      const restored = await restoreSubscription(userId);
      if (!restored) {
        Alert.alert('Nothing to restore', 'This store account has no Band Wall subscription.');
      }
      return restored;
    });

  if (!canBuy) {
    return (
      <Gate title={title} body={`${body} Subscribe from Band Wall on the web.`}>
        {switchBand && <Button title="Switch band" variant="secondary" onPress={switchBand} />}
      </Gate>
    );
  }

  return (
    <Gate
      title={title}
      body={
        awaiting && !stuck
          ? 'Confirming your purchase…'
          : stuck
            ? "We can't confirm your purchase yet. If you bought it, you're covered, so there's no need to buy again."
            : body
      }
    >
      <View style={{ gap: spacing.sm }}>
        {stuck ? (
          <Button title="Try again" onPress={confirm} />
        ) : (
          <Button
            title={action}
            loading={busy === 'paywall'}
            disabled={busy !== null || awaiting}
            onPress={() => void renew()}
          />
        )}
        {switchBand && <Button title="Switch band" variant="secondary" onPress={switchBand} />}
      </View>
      <SmallPrint
        busy={busy === 'restore'}
        disabled={busy !== null || awaiting}
        onRestore={() => void restore()}
      />
    </Gate>
  );
}

function MemberGate({
  name,
  owner,
  switchBand,
}: {
  name: string;
  owner: string | null;
  switchBand?: () => void;
}) {
  return (
    <Gate
      title={`${name}'s owner needs to renew`}
      body={`Everything's safe, just locked for now.${
        owner ? ` Give ${owner} a nudge and it'll open right back up.` : ''
      }`}
    >
      {switchBand && <Button title="Switch band" variant="secondary" onPress={switchBand} />}
    </Gate>
  );
}

/** Restore purchases, the privacy policy and the terms, along one line. */
function SmallPrint({
  busy,
  disabled,
  onRestore,
}: {
  busy: boolean;
  disabled: boolean;
  onRestore: () => void;
}) {
  const links = [
    ['Restore purchases', onRestore, 'button'],
    ['Privacy policy', () => void WebBrowser.openBrowserAsync(BAND_WALL_PLAN.links.privacy), 'link'],
    ['Terms', () => void WebBrowser.openBrowserAsync(BAND_WALL_PLAN.links.terms), 'link'],
  ] as const;
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: spacing.lg,
        rowGap: spacing.xs,
      }}
    >
      {links.map(([label, onPress, role]) => (
        <Pressable
          key={label}
          accessibilityRole={role}
          accessibilityState={role === 'button' ? { disabled, busy } : undefined}
          disabled={role === 'button' && disabled}
          hitSlop={8}
          onPress={onPress}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <ThemedText
            variant="footnote"
            tone="muted"
            style={{ textDecorationLine: 'underline', opacity: role === 'button' && busy ? 0.5 : 1 }}
          >
            {label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}
