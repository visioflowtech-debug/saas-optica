export default function LoadingPacienteDetalle() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-56 bg-card rounded-lg" />
      <div className="flex gap-1 h-12 bg-card rounded-xl border border-b-default" />
      <div className="h-64 bg-card border border-b-default rounded-2xl" />
      <div className="h-48 bg-card border border-b-default rounded-2xl" />
    </div>
  );
}
