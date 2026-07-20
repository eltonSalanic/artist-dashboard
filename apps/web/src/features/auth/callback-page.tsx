"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useSession } from "./use-session";
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

/**
 * Landing page for Supabase email links (invites, magic links). supabase-js
 * picks the session out of the URL automatically; invited users get a chance
 * to set a password so they can sign in normally next time.
 */
export function CallbackPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Spinner />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Link expired</CardTitle>
            <CardDescription>
              This link is invalid or has expired. Ask your board admin to
              re-invite you, or sign in.
            </CardDescription>
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
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    router.replace("/");
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
                onClick={() => router.replace("/")}
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
