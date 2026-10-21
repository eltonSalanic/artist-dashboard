"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Plus, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { CreateBandDialog } from "@/features/shell/create-band-dialog";

/**
 * What someone in no band sees: a new account (sign-up no longer makes a band
 * for you) or someone who has left every band. Creating one switches straight
 * to it; joining happens through a bandmate's invite.
 */
export function NoBand({ email }: { email: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <CreateBandDialog open={creating} onOpenChange={setCreating} />
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Users className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">
            You&apos;re not on any band&apos;s wall yet
          </h1>
          <p className="text-sm text-muted-foreground">
            Join or create one. To join a band, ask one of its admins to
            invite <span className="whitespace-nowrap">{email}</span>; the
            invite opens their wall for you.
          </p>
        </div>
        <Button size="lg" onClick={() => setCreating(true)}>
          <Plus data-icon="inline-start" />
          Create a band
        </Button>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut data-icon="inline-start" />
          Sign out
        </Button>
      </div>
    </main>
  );
}
