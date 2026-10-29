"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authErrorMessage } from "@artist/api-client";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type LinkState =
  | { kind: "checking" }
  | { kind: "in" }
  | { kind: "failed"; message: string };

const LINK_FAILED =
  "This link is invalid or has expired. Ask your board admin to re-invite you, or sign in.";

/**
 * Landing page for the invite email's link, which carries the invite code:
 * `/auth/callback?email=…&code=…`. Signing in with the code joins the band
 * (bootstrap matches the invite by email); then the invited person gets a
 * chance to set a password so they can sign in normally next time.
 */
export function CallbackPage() {
  const router = useRouter();
  const [link, setLink] = useState<LinkState>({ kind: "checking" });
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  // A code works once; React's dev double-run must not spend it twice.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Read directly rather than via useSearchParams, as the login page does,
    // to skip a Suspense boundary for two one-off values.
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");
    const code = params.get("code");
    void (async () => {
      if (!email || !code) {
        // Opened again after joining: carry on if they're already signed in.
        const session = await auth.getSession();
        setLink(session ? { kind: "in" } : { kind: "failed", message: LINK_FAILED });
        return;
      }
      const { error } = await auth.verifyInviteCode(email, code);
      // Drop the code from the address bar and history once it's spent.
      window.history.replaceState(null, "", window.location.pathname);
      setLink(
        error
          ? { kind: "failed", message: authErrorMessage(error, LINK_FAILED) }
          : { kind: "in" },
      );
    })();
  }, []);

  if (link.kind === "checking") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Spinner />
      </main>
    );
  }

  if (link.kind === "failed") {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Link expired</CardTitle>
            <CardDescription>{link.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.replace("/login")}>
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const setPasswordAndContinue = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    const { error } = await auth.setPassword(password);
    setPending(false);
    if (error) {
      toast.error(
        authErrorMessage(error, "Couldn't save your password. Try again."),
      );
      return;
    }
    router.replace("/dashboard");
  };

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>You&apos;re in</CardTitle>
          <CardDescription>
            Set a password so you can sign in next time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={setPasswordAndContinue}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-password">Password</FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Button type="submit" disabled={pending}>
                {pending && <Spinner data-icon="inline-start" />}
                Save and continue
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.replace("/dashboard")}
              >
                Skip for now
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
