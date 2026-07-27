import { Hand } from "lucide-react";
import { BoardDemo } from "@/features/landing/board-demo";
import { SectionHeading } from "@/features/landing/section-heading";

export function InteractiveSection() {
  return (
    <section id="demo" className="px-6 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Board on the left at desktop widths; copy leads on mobile. */}
        <div className="lg:order-1">
          <BoardDemo />
        </div>

        <div className="lg:order-2">
          <SectionHeading
            eyebrow="Make it yours"
            title="Your dashboard, arranged your way."
            lede="Every member keeps their own layout — the same board, seen the way each person works. Drag a widget to move it, pull the corner to resize, hide what you don't need."
          />
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-muted/70 px-3 py-1.5 text-sm text-muted-foreground">
            <Hand className="size-4 text-coral" />
            Go on — try it. Drag, resize, or hide a widget.
          </p>
        </div>
      </div>
    </section>
  );
}
