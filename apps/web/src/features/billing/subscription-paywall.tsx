"use client";

import { Lock, Sparkles } from "lucide-react";
import { BAND_WALL_PLAN } from "@artist/shared";
import { useBoardSubscription } from "@artist/api-client";
import { webCheckoutAvailable } from "@/lib/revenuecat";
import { PLAN_PRICE_LINE } from "./subscription-copy";
import { SubscribeButtons } from "./subscribe-buttons";
import { ConfirmingPurchase } from "./confirming-purchase";
import { useSubscriptionCheckout } from "./use-subscription-checkout";

/**
 * What a locked band shows in place of its wall, when the API enforces billing.
 * The band is open while its owner is subscribed, so its owner gets the plans
 * and everyone else is told who to ask. The header (and its band switcher)
 * stays, so someone in several bands can still reach the open ones.
 */
export function SubscriptionPaywall({
  boardId,
  boardName,
  isOwner,
  userId,
  email,
}: {
  boardId: string;
  boardName: string;
  isOwner: boolean;
  userId: string;
  email: string;
}) {
  if (!isOwner) return <AskTheOwner boardId={boardId} boardName={boardName} />;
  return <RenewPaywall boardName={boardName} userId={userId} email={email} />;
}

function AskTheOwner({
  boardId,
  boardName,
}: {
  boardId: string;
  boardName: string;
}) {
  const subscription = useBoardSubscription(boardId);
  const owner = subscription.data?.ownerName;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Lock className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">
            This band&apos;s owner needs to renew
          </h1>
          <p className="text-sm text-muted-foreground">
            {boardName} is locked for now, and everything&apos;s safe.{" "}
            {owner
              ? `Give ${owner} a nudge and it'll open right back up.`
              : "It'll open right back up once they do."}
          </p>
        </div>
      </div>
    </main>
  );
}

function RenewPaywall({
  boardName,
  userId,
  email,
}: {
  boardName: string;
  userId: string;
  email: string;
}) {
  const { subscribe, offering, opening, awaitingPurchase, stuck, retryConfirm } =
    useSubscriptionCheckout(userId, email);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Sparkles className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">
            {boardName} needs a {BAND_WALL_PLAN.name} subscription
          </h1>
          <p className="text-sm text-muted-foreground">
            You own this band, so your subscription keeps it open for everyone
            in it: {PLAN_PRICE_LINE}.
          </p>
        </div>

        {awaitingPurchase ? (
          <ConfirmingPurchase stuck={stuck} onRetry={retryConfirm} />
        ) : webCheckoutAvailable() ? (
          <SubscribeButtons
            size="lg"
            offering={offering}
            onSubscribe={(plan) => void subscribe(plan)}
            busy={opening}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Subscribe from the Band Wall app on your phone.
          </p>
        )}
      </div>
    </main>
  );
}
