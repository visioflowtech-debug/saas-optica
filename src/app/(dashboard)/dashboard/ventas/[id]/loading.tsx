export default function LoadingVentaDetalle() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-card rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-48 bg-card border border-b-default rounded-2xl" />
          <div className="h-32 bg-card border border-b-default rounded-2xl" />
        </div>
        <div className="space-y-4">
          <div className="h-40 bg-card border border-b-default rounded-2xl" />
          <div className="h-28 bg-card border border-b-default rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
