"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authErrorMessage } from "@artist/api-client";
import { supabase } from "@/lib/supabase";
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

export function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  // Read directly rather than via useSearchParams, which would need a
  // Suspense boundary just for this one flag.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("expired")) {
      toast.info("Your session expired. Please sign in again.", {
        id: "session-expired",
      });
    }
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      const { error } =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
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
    } catch (error) {
      toast.error(authErrorMessage({ message: String(error), status: 0 }));
      return;
    } finally {
      setPending(false);
    }
    router.replace("/dashboard");
  };

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription>
            {mode === "signin"
              ? "Sign in to your band's dashboard."
              : "Start a dashboard for your band."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup>
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
                {mode === "signin" ? "Sign in" : "Create account"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin"
                  ? "New here? Create an account"
                  : "Already have an account? Sign in"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
