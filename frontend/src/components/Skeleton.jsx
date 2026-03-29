// Skeleton building blocks
function Bone({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-border/60 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card-base p-5">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <Bone className="mb-2 h-4 w-32" />
          <Bone className="h-3 w-20" />
        </div>
        <Bone className="h-6 w-20" />
      </div>
      <div className="mb-3 flex gap-4 border-t border-b border-border py-3">
        <Bone className="h-4 flex-1" />
        <Bone className="h-4 flex-1" />
        <Bone className="h-4 flex-1" />
      </div>
      <Bone className="mb-3 h-3 w-full" />
      <Bone className="h-8 w-full rounded-full" />
    </div>
  );
}

export function SkeletonMetric() {
  return (
    <div className="card-base p-4">
      <div className="mb-2 flex items-center justify-between">
        <Bone className="h-3 w-24" />
        <Bone className="h-3 w-4" />
      </div>
      <Bone className="mb-2 h-6 w-20" />
      <Bone className="h-3 w-full" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Bone className="h-4 w-12" />
      <Bone className="h-4 w-16" />
      <Bone className="h-4 w-12" />
      <Bone className="h-4 flex-1" />
      <Bone className="h-4 w-10" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="card-base flex min-h-[250px] items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3">
        <Bone className="h-32 w-48" />
        <Bone className="h-3 w-24" />
      </div>
    </div>
  );
}

export function SkeletonSection({ rows = 3 }) {
  return (
    <div>
      <Bone className="mb-4 h-5 w-40" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Bone key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
