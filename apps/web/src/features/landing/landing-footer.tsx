import { AudioLines } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-border/60 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-coral text-coral-foreground">
            <AudioLines className="size-4" />
          </span>
          <span className="font-heading text-sm font-bold tracking-tight">
            Artist Dashboard
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Artist Dashboard · made by the lame ah
          guitarist from american woman.
        </p>
      </div>
    </footer>
  );
}
