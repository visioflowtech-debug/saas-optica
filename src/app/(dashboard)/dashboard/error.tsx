"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-a-red-bg flex items-center justify-center text-3xl">
        ⚠️
      </div>
      <h2 className="text-xl font-bold text-t-primary">Error al cargar la página</h2>
      <p className="text-t-muted text-sm max-w-sm">
        Ocurrió un problema al obtener los datos. Por favor intenta de nuevo.
      </p>
      <button
        onClick={reset}
        className="px-5 py-2.5 min-h-11 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}
