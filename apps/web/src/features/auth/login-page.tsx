"use client";

import { useEffect, useState } from "react";
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
import { SetupSteps } from "@/features/onboarding/setup-steps";
import { markSignedUp } from "@/features/onboarding/onboarding-state";

export function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const [expired, setExpired] = useState(false);

  // Read directly rather than via useSearchParams, which would need a
  // Suspense boundary just for this one flag. Shown on the card rather than
  // as a toast: this effect runs before the Toaster has mounted, so a toast
  // from here is dropped.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the URL once on mount
    setExpired(params.has("expired"));
    // The landing page's "Create account" opens straight on step 1.
    if (params.get("mode") === "signup") setMode("signup");
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    const { error } =
      mode === "signin"
        ? await auth.signIn(email, password)
        : await auth.signUp(email, password, name.trim());
    setPending(false);
    if (error) {
      toast.error(
        authErrorMessage(
          error,
          mode === "signin"
            ? "Couldn't sign you in. Try again."
            : "Couldn't create your account. Try again.",
        ),
      );
      return;
    }
    // A new account has no band, so the dashboard opens on step 2: naming it.
    if (mode === "signup") markSignedUp();
    router.replace("/dashboard");
  };

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          {mode === "signup" && <SetupSteps current={1} />}
          <CardTitle>
            {mode === "signin" ? "Welcome back" : "First, You."}
          </CardTitle>
          <CardDescription>
            {mode === "signin"
              ? "Sign in to your band's dashboard."
              : "Your bandmates see this name on tasks and shows."}
          </CardDescription>
          {expired && mode === "signin" && (
            <p role="status" className="text-sm text-destructive">
              Your session expired. Please sign in again.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup>
              {mode === "signup" && (
                <Field>
                  <FieldLabel htmlFor="name">Your name</FieldLabel>
                  <Input
                    id="name"
                    autoComplete="name"
                    required
                    maxLength={60}
                    placeholder="Jess Ortega"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Button type="submit" disabled={pending}>
                {pending && <Spinner data-icon="inline-start" />}
                {mode === "signin" ? "Sign in" : "Continue"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin"
                  ? "New here? Start a band"
                  : "Already have an account? Sign in"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
