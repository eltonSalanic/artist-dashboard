import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** After buying, until the API agrees; `stuck` stops the spinner and offers a retry. */
export function ConfirmingPurchase({
  stuck,
  onRetry,
}: {
  stuck: boolean;
  onRetry: () => void;
}) {
  if (!stuck) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Confirming your purchase…
      </p>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-muted-foreground">
        We can&apos;t confirm your purchase yet. If you bought it, you&apos;re
        covered, so there&apos;s no need to buy again.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
