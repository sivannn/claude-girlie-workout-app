import { categoryColorVar, categoryLabel } from "@/lib/design/categories";
import { cn } from "@/lib/utils";
import type { EventStatus } from "@/lib/types/enums";

export function CategoryBadge({
  colorKey,
  label,
  status,
  className,
}: {
  colorKey: string;
  /** Override the default subtype label (e.g. show the workout type name instead) */
  label?: string;
  status?: EventStatus;
  className?: string;
}) {
  const color = categoryColorVar(colorKey);
  const filled = status === undefined || status === "COMPLETED" || status === "IN_PROGRESS";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        className
      )}
      style={
        filled
          ? { backgroundColor: color, color: "var(--cat-on-fill)" }
          : {
              backgroundColor: "transparent",
              color,
              border: `1px solid ${color}`,
              opacity: status === "MISSED" ? 0.55 : 1,
            }
      }
    >
      {label ?? categoryLabel(colorKey)}
    </span>
  );
}
