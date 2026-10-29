import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useQuery } from '@tanstack/react-query';
import { BAND_PRO, type BoardSubscriptionDto } from '@artist/shared';
import {
  useBoardSubscription,
  useMe,
  usePermissions,
  useRefreshBoardSubscription,
} from '@artist/api-client';
import { Button } from '@/components/button';
import { Row } from '@/components/row';
import { Section } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import {
  bandProPackages,
  billingAvailable,
  buyBandPro,
  manageBandPro,
  restoreBandPro,
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
 * Band Pro for one band: the paywall an unpaid band lands on when the API
 * enforces billing, and the screen settings links to. Buying, restoring and
 * managing are for admins ('billing.manage'); the subscription covers every
 * member.
 *
 * The store answers the purchase before RevenueCat's webhook reaches the API,
 * so after buying this polls the board's subscription until the API agrees,
 * then refreshes `/me`, which lets the band back onto its wall.
 */
export function BandProScreen({ boardId }: { boardId: string }) {
  const colors = useThemeColors();
  const { can } = usePermissions();
  const me = useMe(true);
  const name = me.data?.boards.find((b) => b.id === boardId)?.name ?? 'This band';
  const [purchased, setPurchased] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const announced = useRef(false);
  const subscription = useBoardSubscription(boardId, { awaitingPurchase: purchased });
  const refresh = useRefreshBoardSubscription();
  const sub = subscription.data;
  const isPro = sub?.isPro ?? false;
  const canBuy = can('billing.manage') && billingAvailable();

  const packages = useQuery({
    queryKey: ['band-pro-packages', boardId],
    queryFn: () => bandProPackages(boardId),
    enabled: canBuy && !isPro,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!purchased || !isPro || announced.current) return;
    announced.current = true;
    void refresh(boardId);
  }, [purchased, isPro, boardId, refresh]);

  const run = async (key: string, action: () => Promise<boolean>) => {
    setBusy(key);
    try {
      if (await action()) {
        announced.current = false;
        setPurchased(true);
      }
    } catch (error) {
      reportError(error, { where: `bandPro.${key}` });
      Alert.alert("That didn't work", 'Try again in a moment.');
    } finally {
      setBusy(null);
    }
  };

  const buy = (pkg: PurchasesPackage) =>
    run(pkg.identifier, async () => {
      const outcome = await buyBandPro(boardId, pkg);
      return outcome === 'purchased';
    });

  const restore = () =>
    run('restore', async () => {
      const restored = await restoreBandPro(boardId);
      if (!restored) {
        Alert.alert('Nothing to restore', 'This store account has no Band Pro for this band.');
      }
      return restored;
    });

  const awaiting = purchased && !isPro;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.xl }}
    >
      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="title">
          {isPro ? `${name} has ${BAND_PRO.name}` : `${name} needs ${BAND_PRO.name}`}
        </ThemedText>
        <ThemedText variant="subhead" tone="muted">
          {BAND_PRO.name} opens the whole wall for everyone in the band. One subscription covers every
          member.
        </ThemedText>
      </View>

      {sub?.status && (
        <Section title="STATUS">
          <Row
            first
            title={STATUS_COPY[sub.status]}
            meta={
              sub.currentPeriodEnd && sub.status !== 'EXPIRED'
                ? `${sub.willRenew ? 'Renews' : 'Ends'} ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                : null
            }
          />
        </Section>
      )}

      {awaiting && (
        <ThemedText variant="subhead" tone="muted">
          Confirming your purchase…
        </ThemedText>
      )}

      {!isPro && !awaiting && canBuy && (
        <Section title="CHOOSE A PLAN">
          {packages.isPending ? (
            <Skeleton width="100%" height={120} />
          ) : packages.isError || packages.data.length === 0 ? (
            <ThemedText variant="footnote" tone="muted">
              {"Plans couldn't be loaded. Check your connection and try again."}
            </ThemedText>
          ) : (
            packages.data.map((pkg) => (
              <Button
                key={pkg.identifier}
                title={`${pkg.product.title || pkg.identifier} · ${pkg.product.priceString}`}
                loading={busy === pkg.identifier}
                disabled={busy !== null}
                onPress={() => void buy(pkg)}
              />
            ))
          )}
        </Section>
      )}

      {!isPro && !canBuy && (
        <ThemedText variant="subhead" tone="muted">
          {can('billing.manage')
            ? 'Subscribe from Band Wall on the web.'
            : "Ask one of the band's admins to subscribe."}
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
                void manageBandPro(boardId).catch((error: unknown) =>
                  reportError(error, { where: 'bandPro.manage' }),
                )
              }
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}
