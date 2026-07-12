export default function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <Skeleton className="h-4 w-1/3 mb-3" />
      <Skeleton className="h-8 w-1/2 mb-2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <Skeleton className="h-4 w-1/4" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex gap-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-3 w-1/3 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}