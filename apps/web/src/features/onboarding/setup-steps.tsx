import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["You", "Your band", "Open it"] as const;

/** "✓ You · 2 Your band · 3 Open it": where a new owner is in the setup. */
export function SetupSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol
      aria-label={`Step ${current} of ${STEPS.length}`}
      className="flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground"
    >
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        return (
          <li
            key={label}
            aria-current={step === current ? "step" : undefined}
            className={cn(
              "flex items-center gap-1",
              step === current && "text-foreground",
              done && "text-foreground/70",
            )}
          >
            {done ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <span aria-hidden>{step}</span>
            )}
            {label}
          </li>
        );
      })}
    </ol>
  );
}
