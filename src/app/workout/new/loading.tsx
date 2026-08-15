import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the page's own container so the skeleton doesn't jump when the
// real content streams in.
export default function StartWorkoutLoading() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-4 py-6 md:px-8">
      <Skeleton className="h-8 w-48" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}
