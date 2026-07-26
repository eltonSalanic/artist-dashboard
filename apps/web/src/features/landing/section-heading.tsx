import { cn } from "@/lib/utils";

/** The small pill that labels what a section is about. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-coral" />
      {children}
    </span>
  );
}

/**
 * The eyebrow → title → lede stack every section opens with. Left-aligned by
 * default; centered for full-width sections like the closing call to action.
 */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "start",
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  align?: "start" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 max-w-2xl font-heading text-3xl leading-[1.1] font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {lede && (
        <p className="mt-4 max-w-xl text-base text-muted-foreground text-pretty sm:text-lg">
          {lede}
        </p>
      )}
    </div>
  );
}
