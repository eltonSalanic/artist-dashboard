import { cn } from "@/lib/utils";

/**
 * The title → lede stack every section opens with. Left-aligned by default;
 * centered for full-width sections like the closing call to action.
 */
export function SectionHeading({
  title,
  lede,
  align = "start",
  className,
}: {
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
      <h2 className="max-w-2xl font-heading text-3xl leading-[1.1] font-bold tracking-tight text-balance sm:text-4xl">
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
