export default function Loading() {
  return (
    <div className="space-y-6 max-w-5xl animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-24 bg-input rounded-lg" />
          <div className="h-4 w-56 bg-input rounded" />
        </div>
        <div className="h-9 w-36 bg-input rounded-lg" />
      </div>
      {/* KPI */}
      <div className="p-5 bg-card border border-b-default rounded-xl flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-input rounded" />
          <div className="h-9 w-32 bg-input rounded-lg" />
          <div className="h-3 w-16 bg-input rounded" />
        </div>
        <div className="flex flex-wrap gap-2 max-w-xs">
          {[80, 100, 90, 70].map((w, i) => (
            <div key={i} className="h-6 bg-input rounded-full" style={{ width: w }} />
          ))}
        </div>
      </div>
      {/* Lista */}
      <div className="bg-card border border-b-default rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-b-subtle">
          <div className="h-4 w-20 bg-input rounded" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-3 border-b border-b-subtle last:border-0">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-10 space-y-1">
                <div className="h-3 w-full bg-input rounded" />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-48 bg-input rounded" />
                <div className="h-3 w-24 bg-input rounded" />
              </div>
            </div>
            <div className="h-4 w-16 bg-input rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
