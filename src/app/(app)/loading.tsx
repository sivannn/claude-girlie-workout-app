import { Skeleton } from "@/components/ui/skeleton";

// Instant feedback for every tab: these pages are all rendered on demand
// against a remote database, so without a loading boundary a tap shows
// nothing until the server round-trip finishes (and Link prefetching has
// nothing it can cache).
export default function AppLoading() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </div>
  );
}
