export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-input rounded-lg" />
          <div className="h-4 w-52 bg-input rounded" />
        </div>
        <div className="h-9 w-36 bg-input rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-5 bg-card border border-b-default rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-32 bg-input rounded" />
              <div className="h-5 w-14 bg-input rounded-full" />
            </div>
            <div className="h-4 w-full bg-input rounded" />
            <div className="h-3 w-24 bg-input rounded" />
            <div className="grid grid-cols-3 gap-2 pt-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="space-y-1 text-center">
                  <div className="h-5 w-full bg-input rounded" />
                  <div className="h-3 w-full bg-input rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
