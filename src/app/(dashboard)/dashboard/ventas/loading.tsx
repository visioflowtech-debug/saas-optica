export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-24 bg-input rounded-lg" />
          <div className="h-4 w-52 bg-input rounded" />
        </div>
        <div className="h-10 w-40 bg-input rounded-lg" />
      </div>
      <div className="h-11 bg-input rounded-lg" />
      <div className="h-9 w-72 bg-input rounded-lg" />
      <div className="bg-card border border-b-default rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-b-subtle last:border-0">
            <div className="flex-1 h-4 bg-input rounded" />
            <div className="h-5 w-16 bg-input rounded-full" />
            <div className="h-5 w-20 bg-input rounded-full" />
            <div className="h-4 w-16 bg-input rounded ml-auto" />
            <div className="h-4 w-24 bg-input rounded hidden md:block" />
            <div className="h-4 w-20 bg-input rounded hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
