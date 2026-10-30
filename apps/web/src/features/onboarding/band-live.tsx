"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMySubscription, useSendInvite } from "@artist/api-client";
import { useMe } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/**
 * "You're live": the moment a new band opens, in its own colour. Says when
 * the free month ends and puts inviting bandmates one field away.
 */
export function BandLive() {
  const me = useMe(true);
  const [boardId, setBoardId] = useState<string | null>(null);
  const band = me.data?.boards.find((b) => b.id === boardId) ?? null;
  const sub = useMySubscription().data;
  const invite = useSendInvite(boardId ?? "");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the URL once on mount
    setBoardId(new URLSearchParams(window.location.search).get("band"));
  }, []);

  const freeUntil =
    sub?.isTrial && sub.currentPeriodEnd
      ? new Date(sub.currentPeriodEnd).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      : null;

  const send = (event: React.FormEvent) => {
    event.preventDefault();
    const to = email.trim();
    if (!to || !boardId || invite.isPending) return;
    invite.mutate(
      { email: to, role: "USER" },
      {
        onSuccess: () => {
          setSent((list) => [...list, to]);
          setEmail("");
        },
      },
    );
  };

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div
        data-palette={band?.palette ?? "playful"}
        className="w-full max-w-xl"
      >
        <div
          className="flex flex-col gap-6 rounded-3xl p-8 sm:p-10"
          style={{ background: "var(--wc-1)", color: "var(--wc-1-fg)" }}
        >
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold tracking-widest uppercase opacity-75">
              You&apos;re live
            </p>
            <h1 className="font-heading text-4xl font-black tracking-tight text-balance sm:text-5xl">
              {band?.name ?? "Your band"} Is Open.
            </h1>
            <p className="text-base opacity-85">
              {freeUntil ? `Free until ${freeUntil}. ` : ""}Bring the band in:
              they join free.
            </p>
          </div>

          <form
            onSubmit={send}
            className="flex flex-col gap-2 rounded-2xl bg-black/10 p-4"
          >
            <label
              htmlFor="live-invite"
              className="text-xs font-bold tracking-widest uppercase opacity-75"
            >
              Invite a bandmate
            </label>
            <div className="flex gap-2">
              <Input
                id="live-invite"
                type="email"
                autoComplete="off"
                placeholder="bandmate@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-current/40 bg-transparent text-inherit placeholder:text-current/60"
              />
              <Button
                type="submit"
                variant="outline"
                disabled={!email.trim() || !boardId || invite.isPending}
                className="border-current/40 bg-transparent text-inherit hover:bg-black/10"
              >
                {invite.isPending && <Spinner data-icon="inline-start" />}
                Send invite
              </Button>
            </div>
            {sent.length > 0 && (
              <p className="text-sm opacity-85">
                Invited {sent.join(", ")}. They&apos;ll get an email with a
                code.
              </p>
            )}
          </form>

          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/dashboard" />}
            className="self-start rounded-full px-6"
            style={{ background: "var(--wc-1-fg)", color: "var(--wc-1)" }}
          >
            Go to my wall
          </Button>
        </div>
      </div>
    </main>
  );
}
