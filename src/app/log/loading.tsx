import Skeleton from '@/components/ui/Skeleton';

export default function LogLoading() {
  return (
    <div className="p-4 pb-safe space-y-4">
      {/* Header */}
      <Skeleton variant="text" width={200} height={28} />

      {/* Date dots row */}
      <div className="flex gap-3 justify-center py-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} variant="circle" width={36} height={36} />
        ))}
      </div>

      {/* Main log card */}
      <Skeleton variant="card" height={400} />
    </div>
  );
}
