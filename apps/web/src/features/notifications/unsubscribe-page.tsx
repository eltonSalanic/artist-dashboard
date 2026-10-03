"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import {
  NOTIFICATION_CATEGORY_COPY,
  type UnsubscribeResultDto,
} from "@artist/shared";
import { apiFetch, ApiError } from "@artist/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

/**
 * The footer link in every email. Deliberately a button rather than an
 * unsubscribe-on-load: mail scanners and link previewers fetch every URL in a
 * message, and turning someone's email off because their employer's security
 * appliance opened the link would be indefensible.
 *
 * Gmail's own one-click button doesn't come here at all — it POSTs straight to
 * the API from the List-Unsubscribe header, no page involved.
 */
export function UnsubscribePage() {
  const token = useSearchParams().get("token") ?? "";
  const [result, setResult] = useState<UnsubscribeResultDto | null>(null);

  const unsubscribe = useMutation({
    mutationFn: () =>
      apiFetch<UnsubscribeResultDto>(
        `/unsubscribe?token=${encodeURIComponent(token)}`,
        { method: "POST" },
      ),
    onSuccess: setResult,
  });

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        {result ? (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-muted-foreground" />
                You&apos;re unsubscribed
              </CardTitle>
              <CardDescription>
                No more{" "}
                {NOTIFICATION_CATEGORY_COPY[
                  result.category
                ].label.toLowerCase()}{" "}
                emails from {result.boardName}. Other kinds still reach you,
                and you can change any of it in board settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" render={<Link href="/settings" />}>
                Notification settings
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Turn these emails off?</CardTitle>
              <CardDescription>
                {token
                  ? "This turns off one kind of email for one board. Everything else keeps working, and you can turn it back on in settings."
                  : "This link is missing its token. Open the link from the email again, or change your preferences in board settings."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button
                disabled={!token || unsubscribe.isPending}
                onClick={() => unsubscribe.mutate()}
              >
                {unsubscribe.isPending && <Spinner data-icon="inline-start" />}
                Unsubscribe
              </Button>
              {unsubscribe.isError && (
                <p className="text-sm text-destructive">
                  {unsubscribe.error instanceof ApiError
                    ? unsubscribe.error.message
                    : "Couldn't unsubscribe. Try the link from the email again."}
                </p>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
