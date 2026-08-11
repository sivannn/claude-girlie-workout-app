import type { ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The one recurring visual signature for Alex, the AI coach. Per the design
 * philosophy, Alex should only appear when delivering a recommendation or
 * coaching insight — never as a persistent chatbot affordance — so this
 * component is used deliberately, not as a generic card.
 */
export function AlexNote({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("tile flex gap-3 rounded-xl border p-4", className)}
    >
      <span className="relative mt-0.5 h-6 w-6 shrink-0 overflow-hidden rounded-full">
        <Image src="/coach-alex.png" alt="Alex" fill sizes="24px" className="object-cover" />
      </span>
      <div className="min-w-0 flex-1">
        {title ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-alex">
            {title}
          </p>
        ) : null}
        <div className="text-sm leading-relaxed text-foreground/90">
          {children}
        </div>
      </div>
    </div>
  );
}
