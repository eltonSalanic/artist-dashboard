"use client";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

/**
 * The one "this didn't load" screen: says what failed in plain words and
 * always offers a way forward, so no failure is a dead end.
 */
export function ErrorState({
  title = "Couldn't load this",
  message = "Something went wrong. Try again.",
  onRetry,
  retryLabel = "Try again",
  showSignOut = false,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  showSignOut?: boolean;
  className?: string;
}) {
  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.assign("/login");
  };

  return (
    <div
      role="alert"
      className={
        className ??
        "flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
      }
    >
      <h2 className="text-base font-medium">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      <div className="flex gap-2">
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
        {showSignOut && (
          <Button size="sm" variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        )}
      </div>
    </div>
  );
}
