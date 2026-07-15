import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function ProgressBarLabeled({
  label,
  current,
  total,
  formatValue,
  className,
}: {
  label: string;
  current: number;
  total: number;
  /** Custom text for the current/total readout, e.g. "50 / 105 lb" */
  formatValue?: string;
  className?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {formatValue ?? `${current} / ${total}`} · {pct}%
        </span>
      </div>
      <Progress value={pct} />
    </div>
  );
}
