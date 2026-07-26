"use client";

import { AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/features/shell/theme-toggle";

/**
 * The public marketing header. The auth buttons are intentionally not wired to
 * anything yet — they are here to stake out the layout, not to sign anyone in.
 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-coral text-coral-foreground shadow-sm">
            <AudioLines className="size-4.5" />
          </span>
          <span className="font-heading text-base font-bold tracking-tight">
            Artist Dashboard
          </span>
        </a>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <ThemeToggle />
          <Button
            variant="ghost"
            className="hidden h-9 rounded-full px-3.5 text-sm sm:inline-flex"
          >
            Log in
          </Button>
          <Button className="h-9 rounded-full bg-coral px-4 text-sm text-coral-foreground hover:bg-coral/90">
            Create account
          </Button>
        </div>
      </div>
    </header>
  );
}
