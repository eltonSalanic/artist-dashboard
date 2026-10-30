"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { BOARD_PALETTES, type BoardPalette } from "@artist/shared";
import { useCreateBoard } from "@artist/api-client";
import { auth } from "@/lib/auth";
import { selectBoard, useMe } from "@/lib/use-me";
import { webCheckoutAvailable } from "@/lib/revenuecat";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmingPurchase } from "@/features/billing/confirming-purchase";
import { SubscribeButtons } from "@/features/billing/subscribe-buttons";
import { useSubscriptionCheckout } from "@/features/billing/use-subscription-checkout";
import {
  finishBandDraft,
  justSignedUp,
  loadBandDraft,
  saveBandDraft,
} from "./onboarding-state";
import { SetupSteps } from "./setup-steps";

/**
 * What someone in no band sees: step 2 of 3 for a new account, or the way
 * back in for someone who left every band. Name the band and pick its colour,
 * with its block drawn alongside; Continue opens RevenueCat's paywall when a
 * subscription is needed, and the band is created once the purchase is
 * confirmed, then "You're live".
 *
 * The API only creates a band for a subscriber, so the name and colour wait
 * in the browser through the checkout (and a closed tab).
 */
export function StartBand({ email }: { email: string }) {
  const router = useRouter();
  const me = useMe(true);
  const create = useCreateBoard();
  const { subscription, subscribe, offering, opening, awaitingPurchase, stuck, retryConfirm } =
    useSubscriptionCheckout(me.data?.user.id ?? "", email);
  const [name, setName] = useState("");
  const [palette, setPalette] = useState<BoardPalette>("playful");
  const [signingUp, setSigningUp] = useState(false);
  // No RevenueCat paywall in this offering: show our own two plan buttons.
  const [showPlans, setShowPlans] = useState(false);
  // Paying in order to create this band: create it once the API agrees.
  const [wantsBand, setWantsBand] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const started = useRef(false);
  const trimmed = name.trim();

  useEffect(() => {
    const draft = loadBandDraft();
    /* eslint-disable react-hooks/set-state-in-effect -- reads browser storage once on mount */
    setSigningUp(justSignedUp());
    if (draft) {
      setName(draft.name);
      setPalette(draft.palette);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const make = async () => {
    try {
      const board = await create.mutateAsync({ name: trimmed, palette });
      finishBandDraft();
      selectBoard(board.id);
      router.push(`/live?band=${board.id}`);
    } catch {
      // The hook has already said why; the name stays for another go.
      started.current = false;
      setWantsBand(false);
    }
  };

  const isPro = subscription.data?.isPro ?? false;
  // Reads the current name and palette; only the purchase landing starts it.
  const makeOnce = useEffectEvent(() => void make());
  useEffect(() => {
    if (!wantsBand || !isPro || started.current) return;
    started.current = true;
    makeOnce();
  }, [wantsBand, isPro]);

  const next = (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmed || create.isPending) return;
    setNotice(null);
    saveBandDraft({ name: trimmed, palette });
    const block = subscription.data?.createBlock ?? null;

    if (block === "ALREADY_OWNS_BAND") {
      setNotice(
        "A subscription covers one band, and you've got one. Delete it in Settings to start another.",
      );
      return;
    }
    setWantsBand(true);
    if (block !== "NO_SUBSCRIPTION") return;
    if (!webCheckoutAvailable()) {
      setWantsBand(false);
      setNotice("Start your free month from the Band Wall app on your phone, then come back.");
      return;
    }
    if (offering?.hasPaywall) void subscribe();
    else setShowPlans(true);
  };

  const signOut = async () => {
    await auth.signOut();
    router.replace("/login");
  };

  const working = opening || create.isPending || (wantsBand && isPro);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border bg-card md:grid-cols-2">
        <form onSubmit={next} className="flex flex-col gap-5 p-6 sm:p-8">
          {signingUp && <SetupSteps current={2} />}
          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
              New band · you&apos;ll own it
            </p>
            <h1 className="font-heading text-3xl font-black tracking-tight text-balance">
              Name Your Band.
            </h1>
          </div>

          <Field>
            <FieldLabel htmlFor="band-name">Band name</FieldLabel>
            <Input
              id="band-name"
              autoFocus
              maxLength={80}
              placeholder="The Midnight Owls"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={working}
            />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-bold tracking-widest text-muted-foreground uppercase">
              Pick its colour
            </legend>
            <div className="flex gap-3">
              {BOARD_PALETTES.map((option) => (
                <label key={option.id} data-palette={option.id} title={option.label}>
                  <input
                    type="radio"
                    name="band-palette"
                    value={option.id}
                    checked={palette === option.id}
                    onChange={() => setPalette(option.id)}
                    disabled={working}
                    className="peer sr-only"
                  />
                  <span className="sr-only">{option.label}</span>
                  <span
                    aria-hidden
                    className="block size-9 cursor-pointer rounded-full ring-offset-2 ring-offset-card transition peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                    style={{ background: "var(--wc-1)" }}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

          {awaitingPurchase ? (
            <ConfirmingPurchase stuck={stuck} onRetry={retryConfirm} />
          ) : showPlans && !isPro ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-muted-foreground">
                Pick a plan to open {trimmed || "your band"}.
              </p>
              <SubscribeButtons
                offering={offering}
                onSubscribe={(plan) => void subscribe(plan)}
                busy={opening}
              />
            </div>
          ) : (
            <Button type="submit" size="lg" className="self-start px-6" disabled={!trimmed || working}>
              {working && <Spinner data-icon="inline-start" />}
              Continue
            </Button>
          )}

          <div className="mt-auto flex flex-col items-start gap-2 pt-2">
            <p className="text-sm text-muted-foreground">
              Joining a band instead? Ask one of its admins to invite{" "}
              <span className="whitespace-nowrap">{email}</span>.
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={signOut}>
              <LogOut data-icon="inline-start" />
              Sign out
            </Button>
          </div>
        </form>

        <div
          data-palette={palette}
          className="flex flex-col justify-center gap-3 bg-muted/40 p-6 sm:p-8"
        >
          <div
            className="flex flex-col gap-1 rounded-3xl p-5"
            style={{ background: "var(--wc-1)", color: "var(--wc-1-fg)" }}
          >
            <span className="text-xs font-bold tracking-widest uppercase opacity-75">
              Owner · You
            </span>
            <span className="font-heading text-3xl font-black tracking-tight break-words">
              {trimmed || "Your band"}
            </span>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {["--wc-2", "--wc-3", "--wc-4", "--card"].map((slot) => (
                <span
                  key={slot}
                  className={cn("h-10 rounded-xl", slot === "--card" && "opacity-80")}
                  style={{ background: `var(${slot})` }}
                />
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Your wall, as your band will see it.</p>
        </div>
      </div>
    </main>
  );
}
