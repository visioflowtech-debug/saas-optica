export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 bg-input rounded-lg" />
          <div className="h-4 w-52 bg-input rounded" />
        </div>
        <div className="h-10 w-32 bg-input rounded-lg" />
      </div>
      {/* Kanban columns skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, col) => (
          <div key={col} className="bg-card border border-b-default rounded-xl p-4 space-y-3">
            <div className="h-5 w-24 bg-input rounded" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-input rounded-lg p-3 space-y-2">
                <div className="h-4 w-32 bg-card rounded" />
                <div className="h-3 w-20 bg-card rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
