"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AUTH_CODE_ERRORS, authErrorMessage } from "@artist/api-client";
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
  const [mode, setMode] = useState<"signin" | "signup" | "verify">("signin");
  // Which door led to "Check your email": a new account keeps its step 1.
  const [verifyFrom, setVerifyFrom] = useState<"signin" | "signup">("signup");
  const [code, setCode] = useState("");
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

  const startVerify = (from: "signin" | "signup") => {
    setVerifyFrom(from);
    setCode("");
    setMode("verify");
  };

  /** Confirming the code signs the person in. */
  const confirmEmail = async () => {
    setPending(true);
    const { error } = await auth.verifyEmailCode(email.trim(), code.trim());
    setPending(false);
    if (error) {
      toast.error(
        error.code && AUTH_CODE_ERRORS.includes(error.code)
          ? "That code doesn't work: check it against the email, or send a new one. Codes expire after an hour."
          : authErrorMessage(error, "Couldn't confirm your email. Try again."),
      );
      return;
    }
    if (verifyFrom === "signup") markSignedUp();
    router.replace("/dashboard");
  };

  const resend = async () => {
    setPending(true);
    const { error } = await auth.resendEmailCode(email.trim());
    setPending(false);
    if (error) {
      toast.error(
        authErrorMessage(error, "Couldn't send a new code. Try again."),
      );
    } else {
      toast.success("New code sent. It can take a minute to arrive.");
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "verify") {
      await confirmEmail();
      return;
    }
    setPending(true);
    const result =
      mode === "signin"
        ? await auth.signIn(email, password)
        : await auth.signUp(email, password, name.trim());
    setPending(false);
    const { error } = result;
    // A new account, or one that never confirmed: a code is on its way.
    if (error?.code === "EMAIL_NOT_VERIFIED") {
      startVerify("signin");
      return;
    }
    if ("needsConfirmation" in result && result.needsConfirmation) {
      startVerify("signup");
      return;
    }
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
          {(mode === "signup" ||
            (mode === "verify" && verifyFrom === "signup")) && (
            <SetupSteps current={1} />
          )}
          <CardTitle>
            {mode === "signin"
              ? "Welcome back"
              : mode === "signup"
                ? "First, You."
                : "Check your email"}
          </CardTitle>
          <CardDescription>
            {mode === "signin"
              ? "Sign in to your band's dashboard."
              : mode === "signup"
                ? "Your bandmates see this name on tasks and shows."
                : `We sent a 6-digit code to ${email.trim()}. Enter it to finish.`}
          </CardDescription>
          {expired && mode === "signin" && (
            <p role="status" className="text-sm text-destructive">
              Your session expired. Please sign in again.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {mode === "verify" ? (
            <form onSubmit={submit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="code">Code</FieldLabel>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                  />
                </Field>
                <Button type="submit" disabled={pending || code.length !== 6}>
                  {pending && <Spinner data-icon="inline-start" />}
                  Confirm
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => void resend()}
                >
                  Send a new code
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setMode(verifyFrom)}
                >
                  Use a different email
                </Button>
              </FieldGroup>
            </form>
          ) : (
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
                  onClick={() =>
                    setMode(mode === "signin" ? "signup" : "signin")
                  }
                >
                  {mode === "signin"
                    ? "New here? Start a band"
                    : "Already have an account? Sign in"}
                </Button>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
