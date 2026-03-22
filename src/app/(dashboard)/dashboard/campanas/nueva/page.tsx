import { crearCampana } from "../actions";
import Link from "next/link";

export default async function NuevaCampanaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/dashboard/campanas"
        className="inline-flex items-center gap-1 text-sm text-t-muted hover:text-t-primary transition"
      >
        ← Volver a campañas
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-t-primary">Nueva Campaña</h1>
        <p className="text-t-muted text-sm mt-1">
          Crea una campaña de atención para agrupar pacientes, exámenes y ventas por zona o evento.
        </p>
      </div>

      {params.error && (
        <div className="p-3 bg-a-red-bg border border-a-red-border rounded-lg text-t-red text-sm">
          {decodeURIComponent(params.error)}
        </div>
      )}

      <form className="space-y-6 p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-t-secondary mb-1.5">
            Nombre de la campaña *
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            placeholder="Ej: Guatajiagua, Ahuachapán, Feria Salud 2026..."
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        <div>
          <label htmlFor="descripcion" className="block text-sm font-medium text-t-secondary mb-1.5">
            Descripción (opcional)
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={3}
            placeholder="Detalles sobre la campaña, objetivo, zona de cobertura..."
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="fecha_inicio" className="block text-sm font-medium text-t-secondary mb-1.5">
              Fecha de inicio
            </label>
            <input
              id="fecha_inicio"
              name="fecha_inicio"
              type="date"
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
          <div>
            <label htmlFor="fecha_fin" className="block text-sm font-medium text-t-secondary mb-1.5">
              Fecha de cierre
            </label>
            <input
              id="fecha_fin"
              name="fecha_fin"
              type="date"
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-b-subtle flex justify-end gap-3">
          <Link
            href="/dashboard/campanas"
            className="px-4 py-2 text-sm text-t-muted hover:text-t-primary border border-b-default rounded-lg transition"
          >
            Cancelar
          </Link>
          <button
            formAction={crearCampana}
            className="px-6 py-2 bg-[var(--accent-blue)] hover:bg-blue-500 text-white font-semibold text-sm rounded-lg transition"
          >
            Crear Campaña
          </button>
        </div>
      </form>
    </div>
  );
}
