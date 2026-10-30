import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { PurchasesPackage } from 'react-native-purchases';
import { useQuery } from '@tanstack/react-query';
import { BAND_WALL_PLAN, type BoardSubscriptionDto } from '@artist/shared';
import {
  useBoardSubscription,
  useMe,
  usePurchaseConfirmation,
  useRefreshSubscription,
} from '@artist/api-client';
import { Button } from '@/components/button';
import { Row } from '@/components/row';
import { Section } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import {
  planPackages,
  billingAvailable,
  buySubscription,
  manageSubscription,
  restoreSubscription,
  showPaywall,
} from '@/features/billing/purchases';
import { reportError } from '@/lib/report-error';
import { spacing, useThemeColors } from '@/theme';

const STATUS_COPY: Record<NonNullable<BoardSubscriptionDto['status']>, string> = {
  ACTIVE: 'Active',
  GRACE: 'Payment problem: still on while the store retries',
  CANCELLED: 'Cancelled: on until the paid period ends',
  EXPIRED: 'Expired',
};

/**
 * The subscription screen. With a `boardId` it's about that band: the owner
 * gets their plans, and everyone else is told it's the owner's call. Without
 * one it's about you, for someone about to create their first band.
 *
 * The store answers the purchase before RevenueCat's webhook reaches the API,
 * so after buying this polls your subscription until the API agrees, then
 * refreshes `/me`, which lets the band back onto its wall.
 *
 * Plans are sold through RevenueCat's paywall, which opens by itself for someone
 * creating their first band and from a button on a locked band. The plain plan
 * list only shows if the paywall can't load.
 */
export function SubscriptionScreen({
  boardId,
  footer,
}: {
  boardId?: string;
  /** Extra controls at the end of the scrolling content (the hub's Switch band). */
  footer?: ReactNode;
}) {
  const colors = useThemeColors();
  const board = useBoardSubscription(boardId);
  const isOwner = board.data?.isOwner ?? false;

  if (boardId && !board.data) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }
  if (boardId && !isOwner) {
    return <MemberView boardId={boardId} footer={footer} />;
  }
  return <OwnerView boardId={boardId} footer={footer} />;
}

/** It's the owner's subscription, so a member only hears where the band stands. */
function MemberView({ boardId, footer }: { boardId: string; footer?: ReactNode }) {
  const colors = useThemeColors();
  const me = useMe(true);
  const board = useBoardSubscription(boardId);
  const name = me.data?.boards.find((b) => b.id === boardId)?.name ?? 'This band';
  const owner = board.data?.ownerName;
  const locked = board.data?.required ?? false;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.xl }}
    >
      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="title">
          {locked ? "This band's owner needs to renew" : `${name} is good to go`}
        </ThemedText>
        <ThemedText variant="subhead" tone="muted">
          {locked
            ? `${name} is locked for now, and everything's safe. ${
                owner ? `Give ${owner} a nudge and it'll open right back up.` : ''
              }`
            : `${owner ?? 'The owner'}'s subscription covers everyone in the band.`}
        </ThemedText>
      </View>
      {footer}
    </ScrollView>
  );
}

function OwnerView({ boardId, footer }: { boardId?: string; footer?: ReactNode }) {
  const colors = useThemeColors();
  const me = useMe(true);
  const userId = me.data?.user.id ?? '';
  const name = me.data?.boards.find((b) => b.id === boardId)?.name ?? 'Your band';
  const [busy, setBusy] = useState<string | null>(null);
  const [paywallFailed, setPaywallFailed] = useState(false);
  const announced = useRef(false);
  const paywallOpened = useRef(false);
  const { subscription, purchased, awaiting, stuck, confirm } = usePurchaseConfirmation();
  const refresh = useRefreshSubscription();
  const sub = subscription.data;
  const isPro = sub?.isPro ?? false;
  const canBuy = billingAvailable();

  const packages = useQuery({
    queryKey: ['subscription-packages', userId],
    queryFn: () => planPackages(userId),
    enabled: canBuy && !!userId && !isPro,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!purchased || !isPro || announced.current) return;
    announced.current = true;
    void refresh().then(() => {
      // Bought in order to create a band: straight on to naming it.
      if (!boardId) router.replace('/boards?create=1');
    });
  }, [purchased, isPro, boardId, refresh]);

  const run = async (key: string, action: () => Promise<boolean>) => {
    setBusy(key);
    try {
      if (await action()) {
        announced.current = false;
        confirm();
      }
    } catch (error) {
      reportError(error, { where: `subscription.${key}` });
      Alert.alert("That didn't work", 'Try again in a moment.');
    } finally {
      setBusy(null);
    }
  };

  const buy = (pkg: PurchasesPackage) =>
    run(pkg.identifier, async () => {
      const outcome = await buySubscription(userId, pkg);
      return outcome === 'purchased';
    });

  const openPaywall = () =>
    run('paywall', async () => {
      try {
        const outcome = await showPaywall(userId);
        if (outcome === 'unavailable') setPaywallFailed(true);
        return outcome === 'subscribed';
      } catch (error) {
        reportError(error, { where: 'subscription.paywall' });
        setPaywallFailed(true);
        return false;
      }
    });
  const openPaywallOnce = useEffectEvent(openPaywall);

  // Pressing Create A Band already asked for this, so skip the extra tap.
  const opensByItself = !boardId && canBuy && !!userId && subscription.data?.isPro === false;
  useEffect(() => {
    if (!opensByItself || paywallOpened.current) return;
    paywallOpened.current = true;
    void openPaywallOnce();
  }, [opensByItself]);

  const restore = () =>
    run('restore', async () => {
      const restored = await restoreSubscription(userId);
      if (!restored) {
        Alert.alert('Nothing to restore', 'This store account has no Band Wall subscription.');
      }
      return restored;
    });

  const anyTrial = packages.data?.some((p) => p.freeTrial) ?? true;
  const trialNote = packages.data?.some((p) => p.freeTrial) && (
    <ThemedText variant="footnote" tone="muted">
      {`First month's on us. After that it's ${packages.data
        .map(({ pkg }) => `${pkg.product.priceString} ${pkg.packageType === 'ANNUAL' ? 'a year' : 'a month'}`)
        .join(' or ')}. Cancel before it's up and you won't pay a thing.`}
    </ThemedText>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.xl }}
    >
      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="title">
          {!boardId
            ? isPro
              ? `You're subscribed to ${BAND_WALL_PLAN.name}`
              : 'Start your band'
            : isPro
              ? `${name} has a ${BAND_WALL_PLAN.name} subscription`
              : `${name} needs a ${BAND_WALL_PLAN.name} subscription`}
        </ThemedText>
        <ThemedText variant="subhead" tone="muted">
          {boardId
            ? 'You own this band, so your subscription keeps it open for everyone in it.'
            : `A ${BAND_WALL_PLAN.name} subscription lets you own a band, and it covers everyone in it. Joining a band is always free.`}
        </ThemedText>
      </View>

      {sub?.status && (
        <Section title="STATUS">
          <Row
            first
            title={sub.isTrial && sub.status !== 'EXPIRED' ? 'Free month' : STATUS_COPY[sub.status]}
            meta={
              sub.currentPeriodEnd && sub.status !== 'EXPIRED'
                ? `${sub.willRenew ? (sub.isTrial ? 'Paid plan kicks in' : 'Renews') : 'Ends'} ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                : null
            }
          />
        </Section>
      )}

      {awaiting && !stuck && (
        <ThemedText variant="subhead" tone="muted">
          Confirming your purchase…
        </ThemedText>
      )}

      {stuck && (
        <View style={{ gap: spacing.sm }}>
          <ThemedText variant="subhead" tone="muted">
            {"We can't confirm your purchase yet. If you bought it, you're covered, so there's no need to buy again."}
          </ThemedText>
          <Button title="Try again" onPress={confirm} />
        </View>
      )}

      {!isPro && !awaiting && canBuy && !paywallFailed && (
        <View style={{ gap: spacing.sm }}>
          <Button
            title={anyTrial ? 'Start free trial' : `Subscribe to ${BAND_WALL_PLAN.name}`}
            loading={busy === 'paywall'}
            disabled={busy !== null}
            onPress={() => void openPaywall()}
          />
          {trialNote}
        </View>
      )}

      {!isPro && !awaiting && canBuy && paywallFailed && (
        <Section title="CHOOSE A PLAN">
          {packages.isPending ? (
            <Skeleton width="100%" height={120} />
          ) : packages.isError || packages.data.length === 0 ? (
            <ThemedText variant="footnote" tone="muted">
              {"Plans couldn't be loaded. Check your connection and try again."}
            </ThemedText>
          ) : (
            <>
              {packages.data.map(({ pkg, freeTrial }) => (
                <Button
                  key={pkg.identifier}
                  title={
                    freeTrial
                      ? `Start free trial · ${pkg.identifier === BAND_WALL_PLAN.plans.yearly.packageId ? 'Yearly' : 'Monthly'}`
                      : `${pkg.product.title || pkg.identifier} · ${pkg.product.priceString}${
                          pkg.identifier === BAND_WALL_PLAN.plans.yearly.packageId
                            ? ` · ${BAND_WALL_PLAN.plans.yearly.savings}`
                            : ''
                        }`
                  }
                  loading={busy === pkg.identifier}
                  disabled={busy !== null}
                  onPress={() => void buy(pkg)}
                />
              ))}
              {trialNote}
            </>
          )}
        </Section>
      )}

      {!isPro && !canBuy && (
        <ThemedText variant="subhead" tone="muted">
          Subscribe from Band Wall on the web.
        </ThemedText>
      )}

      {canBuy && (
        <View style={{ gap: spacing.sm }}>
          {!isPro && (
            <Button
              title="Restore purchases"
              variant="ghost"
              loading={busy === 'restore'}
              disabled={busy !== null}
              onPress={() => void restore()}
            />
          )}
          {isPro && sub?.store !== 'PROMOTIONAL' && (
            <Button
              title="Manage subscription"
              variant="secondary"
              onPress={() =>
                void manageSubscription(userId).catch((error: unknown) =>
                  reportError(error, { where: 'subscription.manage' }),
                )
              }
            />
          )}
        </View>
      )}
      {!isPro && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg }}>
          {(
            [
              ['Terms', BAND_WALL_PLAN.links.terms],
              ['Privacy', BAND_WALL_PLAN.links.privacy],
            ] as const
          ).map(([label, url]) => (
            <Pressable
              key={label}
              accessibilityRole="link"
              hitSlop={8}
              onPress={() => void WebBrowser.openBrowserAsync(url)}
            >
              <ThemedText variant="footnote" tone="muted" style={{ textDecorationLine: 'underline' }}>
                {label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}
      {footer}
    </ScrollView>
  );
}
