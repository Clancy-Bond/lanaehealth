import Skeleton from '@/components/ui/Skeleton';

export default function PatternsLoading() {
  return (
    <div className="p-4 pb-safe space-y-4">
      {/* Header */}
      <Skeleton variant="text" width={180} height={28} />

      {/* Tab bar pills */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            width={80}
            height={32}
            className="rounded-full"
          />
        ))}
      </div>

      {/* Chart area */}
      <Skeleton variant="rect" height={300} />

      {/* Stacked insight cards */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="card" height={100} />
        ))}
      </div>
    </div>
  );
}
