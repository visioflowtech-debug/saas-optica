export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-36 bg-input rounded-lg" />
        <div className="h-4 w-64 bg-input rounded" />
      </div>
      {/* Tabs skeleton */}
      <div className="flex gap-1 border-b border-b-default pb-0">
        {[80, 96, 88, 72].map((w, i) => (
          <div key={i} className="h-9 bg-input rounded-t-lg" style={{ width: w }} />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="bg-card border border-b-default rounded-xl p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-24 bg-input rounded" />
            <div className="h-10 w-full bg-input rounded-lg" />
          </div>
        ))}
        <div className="h-10 w-32 bg-input rounded-lg" />
      </div>
    </div>
  );
}
