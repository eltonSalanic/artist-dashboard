"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BAND_WALL_PLAN } from "@artist/shared";
import { useCreateBoard, useMySubscription } from "@artist/api-client";
import { selectBoard, useMe } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { webCheckoutAvailable } from "@/lib/revenuecat";
import { PLAN_PRICE_LINE } from "@/features/billing/subscription-copy";
import { SubscribeButtons } from "@/features/billing/subscribe-buttons";
import { useSubscriptionCheckout } from "@/features/billing/use-subscription-checkout";

/**
 * "Create a band": a name, then a new band with you as its owner and admin,
 * with the default layout and statuses. Switches to it once it exists. With
 * billing enforced, owning a band takes a subscription and covers one band, so
 * this asks for that first.
 */
export function CreateBandDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const create = useCreateBoard();
  const [name, setName] = useState("");
  const mine = useMySubscription({ enabled: open });
  const block = mine.data?.createBlock ?? null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || create.isPending) return;
    create.mutate(trimmed, {
      onSuccess: (board) => {
        selectBoard(board.id);
        setName("");
        onOpenChange(false);
        router.push("/dashboard");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {block === "NO_SUBSCRIPTION" ? (
          <SubscribeToCreate />
        ) : block === "ALREADY_OWNS_BAND" ? (
          <AlreadyOwnsBand onClose={() => onOpenChange(false)} />
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Create a band</DialogTitle>
              <DialogDescription>
                You&apos;ll own it. Invite your bandmates from Settings once
                it&apos;s set up.
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="new-band-name">Band name</FieldLabel>
              <Input
                id="new-band-name"
                autoFocus
                maxLength={80}
                placeholder="The Midnight Owls"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || create.isPending}>
                {create.isPending ? "Creating…" : "Create band"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Owning a band takes a subscription. The form appears once the API agrees. */
function SubscribeToCreate() {
  const me = useMe(true);
  const { subscribe, offering, opening, awaitingPurchase } =
    useSubscriptionCheckout(me.data?.user.id ?? "", me.data?.user.email);

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Start your band</DialogTitle>
        <DialogDescription>
          A {BAND_WALL_PLAN.name} subscription lets you own a band, and it
          covers everyone in it: {PLAN_PRICE_LINE}. Joining a band is always
          free.
        </DialogDescription>
      </DialogHeader>
      {awaitingPurchase ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Confirming your purchase…
        </p>
      ) : webCheckoutAvailable() ? (
        <SubscribeButtons
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
  );
}

function AlreadyOwnsBand({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>You&apos;ve already got a band</DialogTitle>
        <DialogDescription>
          A subscription covers one band. Delete yours in Settings and you can
          start a new one. You can still join as many bands as you like.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button onClick={onClose}>Got it</Button>
      </DialogFooter>
    </div>
  );
}
