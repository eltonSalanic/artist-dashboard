import { AudioLines } from "lucide-react";

const LINKS = [
  { href: "#top", label: "Overview" },
  { href: "#demo", label: "Make it yours" },
];

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

        <nav className="flex items-center gap-5 text-sm text-muted-foreground">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Artist Dashboard · Built for bands.
        </p>
      </div>
    </footer>
  );
}
