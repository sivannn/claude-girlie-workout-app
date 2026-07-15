import type { ReactNode } from "react";
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
      className={cn(
        "flex gap-3 rounded-xl border border-accent/25 bg-accent/10 p-4",
        className
      )}
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
        A
      </span>
      <div className="min-w-0 flex-1">
        {title ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">
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
