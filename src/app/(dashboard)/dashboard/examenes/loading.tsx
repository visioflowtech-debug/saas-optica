export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-44 bg-input rounded-lg" />
          <div className="h-4 w-36 bg-input rounded" />
        </div>
        <div className="h-10 w-36 bg-input rounded-lg" />
      </div>
      <div className="bg-card border border-b-default rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-b-subtle last:border-0">
            <div className="h-4 w-24 bg-input rounded" />
            <div className="h-4 w-36 bg-input rounded" />
            <div className="h-4 w-20 bg-input rounded hidden md:block" />
            <div className="h-4 w-20 bg-input rounded hidden md:block" />
            <div className="h-4 w-28 bg-input rounded hidden lg:block" />
            <div className="h-4 w-12 bg-input rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
