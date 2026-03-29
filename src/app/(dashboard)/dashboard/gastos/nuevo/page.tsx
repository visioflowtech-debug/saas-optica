import { registrarGasto } from "../actions";
import { obtenerCategoriasGasto } from "@/app/(dashboard)/dashboard/configuracion/categorias-actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NuevoGastoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; campana_id?: string }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("sucursal_id, tenant_id")
    .eq("id", user.id)
    .single();

  // Campañas activas de la sucursal para asociar el gasto
  let campanas: { id: string; nombre: string }[] = [];
  if (perfil?.sucursal_id) {
    const { data: suc } = await supabase
      .from("sucursales")
      .select("campanas_activas")
      .eq("id", perfil.sucursal_id)
      .single();

    if (suc?.campanas_activas) {
      const { data } = await supabase
        .from("campanas")
        .select("id, nombre")
        .eq("sucursal_id", perfil.sucursal_id)
        .eq("activa", true)
        .order("nombre");
      campanas = data || [];
    }
  }

  const categorias = await obtenerCategoriasGasto();
  const categoriasActivas = categorias.filter((c) => c.activo);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href={params.campana_id ? `/dashboard/campanas/${params.campana_id}` : "/dashboard/gastos"}
        className="inline-flex items-center gap-1 text-sm text-t-muted hover:text-t-primary transition"
      >
        {params.campana_id ? "← Volver a campaña" : "← Volver a gastos"}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-t-primary">Registrar Gasto</h1>
        <p className="text-t-muted text-sm mt-1">Registra un gasto operativo o de campaña</p>
      </div>

      {params.error && (
        <div className="p-3 bg-a-red-bg border border-a-red-border rounded-lg text-t-red text-sm">
          {decodeURIComponent(params.error)}
        </div>
      )}

      <form className="space-y-5 p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">

        {campanas.length > 0 && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <label htmlFor="campana_id" className="block text-sm font-semibold text-t-primary mb-1.5">
              📍 Campaña (opcional)
            </label>
            <select
              id="campana_id"
              name="campana_id"
              defaultValue={params.campana_id || ""}
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              <option value="">— Gasto general de sucursal —</option>
              {campanas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="concepto" className="block text-sm font-medium text-t-secondary mb-1.5">
            Concepto *
          </label>
          <input
            id="concepto"
            name="concepto"
            type="text"
            required
            placeholder="Ej: Combustible viaje Guatajiagua, Almuerzo equipo..."
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="categoria" className="block text-sm font-medium text-t-secondary mb-1.5">
              Categoría *
            </label>
            <select
              id="categoria"
              name="categoria"
              required
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              {categoriasActivas.map((c) => (
                <option key={c.valor} value={c.valor}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="monto" className="block text-sm font-medium text-t-secondary mb-1.5">
              Monto ($) *
            </label>
            <input
              id="monto"
              name="monto"
              type="number"
              required
              min="0.01"
              step="0.01"
              placeholder="0.00"
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
        </div>

        <div>
          <label htmlFor="fecha" className="block text-sm font-medium text-t-secondary mb-1.5">
            Fecha *
          </label>
          <input
            id="fecha"
            name="fecha"
            type="date"
            required
            defaultValue={today}
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        <div>
          <label htmlFor="notas" className="block text-sm font-medium text-t-secondary mb-1.5">
            Notas (opcional)
          </label>
          <textarea
            id="notas"
            name="notas"
            rows={2}
            placeholder="Descripción adicional, comprobante, etc..."
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
          />
        </div>

        <div className="pt-4 border-t border-b-subtle flex justify-end gap-3">
          <Link
            href={params.campana_id ? `/dashboard/campanas/${params.campana_id}` : "/dashboard/gastos"}
            className="px-4 py-2 text-sm text-t-muted hover:text-t-primary border border-b-default rounded-lg transition"
          >
            Cancelar
          </Link>
          <button
            formAction={registrarGasto}
            className="px-6 py-2 bg-[var(--accent-blue)] hover:bg-blue-500 text-white font-semibold text-sm rounded-lg transition"
          >
            Guardar Gasto
          </button>
        </div>
      </form>
    </div>
  );
}
