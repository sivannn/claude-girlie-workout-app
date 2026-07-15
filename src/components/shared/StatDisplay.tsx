import { cn } from "@/lib/utils";

export function StatDisplay({
  value,
  label,
  sublabel,
  size = "md",
  className,
}: {
  value: string;
  label: string;
  sublabel?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span
        className={cn(
          "font-semibold tracking-tight text-foreground tabular-nums",
          size === "lg" && "text-4xl",
          size === "md" && "text-2xl",
          size === "sm" && "text-lg"
        )}
      >
        {value}
      </span>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {sublabel ? (
        <span className="mt-0.5 text-xs text-muted-foreground/80">{sublabel}</span>
      ) : null}
    </div>
  );
}
