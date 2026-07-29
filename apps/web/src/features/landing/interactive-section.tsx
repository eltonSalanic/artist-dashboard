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
            title="Your board, your way."
            lede="Everyone gets to customize their board so no one get's to say it's too confusing"
          />
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-muted/70 px-3 py-1.5 text-sm text-muted-foreground">
            <Hand className="size-4 text-coral" />
            Go on brochacho, test it out.
          </p>
        </div>
      </div>
    </section>
  );
}
