import { crearPaciente, obtenerProfesiones } from "../actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProfesionCombobox from "@/components/profesion-combobox";

const ETIQUETAS_COMUNES = [
  "Diabetes", "Hipertensión", "Glaucoma", "Cataratas",
  "Astigmatismo", "Miopía", "Hipermetropía", "Presbicia",
  "Retinopatía", "Ojo seco",
];

export default async function NuevoPacientePage({
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

  // Verificar si la sucursal tiene campanas activas
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

  const campanaPreseleccionada = params.campana_id || "";
  const profesionesList = await obtenerProfesiones();

  // Contexto de navegación: si viene de una campaña, regresar a ella
  const backHref = campanaPreseleccionada
    ? `/dashboard/campanas/${campanaPreseleccionada}`
    : "/dashboard/pacientes";
  const backLabel = campanaPreseleccionada ? "← Volver a campaña" : "← Volver a pacientes";

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-t-muted hover:text-t-primary transition">
        {backLabel}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-t-primary">Nuevo Paciente</h1>
        <p className="text-t-muted text-sm mt-1">Registrar un nuevo paciente en tu sucursal</p>
      </div>

      {params.error && (
        <div className="p-3 bg-a-red-bg border border-a-red-border rounded-lg text-t-red text-sm">{params.error}</div>
      )}

      <form className="space-y-6 p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        {/* Campo oculto campana_id (siempre incluido para routing context) */}
        {campanaPreseleccionada && campanas.length === 0 && (
          <input type="hidden" name="campana_id" value={campanaPreseleccionada} />
        )}

        {/* Selector de campaña (solo si hay campanas activas) */}
        {campanas.length > 0 && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <label htmlFor="campana_id" className="block text-sm font-semibold text-t-primary mb-1.5">
              📍 Campaña
            </label>
            <select
              id="campana_id"
              name="campana_id"
              defaultValue={campanaPreseleccionada}
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              <option value="">— Sin campaña (sucursal general) —</option>
              {campanas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-t-muted mt-1">
              Asigna este paciente a una campaña activa para agrupar su atención.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-t-secondary mb-1.5">Nombre completo *</label>
          <input id="nombre" name="nombre" type="text" required placeholder="Nombre del paciente"
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="telefono" className="block text-sm font-medium text-t-secondary mb-1.5">Teléfono</label>
            <input id="telefono" name="telefono" type="tel" placeholder="+503 7890-1234"
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-t-secondary mb-1.5">Correo electrónico</label>
            <input id="email" name="email" type="email" placeholder="paciente@email.com"
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="fecha_nacimiento" className="block text-sm font-medium text-t-secondary mb-1.5">Fecha de nacimiento</label>
            <input id="fecha_nacimiento" name="fecha_nacimiento" type="date"
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
          <div>
            <label htmlFor="profesion" className="block text-sm font-medium text-t-secondary mb-1.5">Profesión</label>
            <ProfesionCombobox profesionesList={profesionesList} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-t-secondary mb-1.5">Etiquetas médicas</label>
          <input name="etiquetas_medicas" type="text" placeholder="Diabetes, Miopía, Hipertensión..."
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {ETIQUETAS_COMUNES.map((tag) => (
              <button key={tag} type="button"
                className="px-2.5 py-1 text-[11px] font-medium bg-badge text-t-secondary border border-b-default rounded-full hover:bg-card-hover hover:text-t-primary transition cursor-pointer">
                + {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input id="acepta_marketing" name="acepta_marketing" type="checkbox"
            className="w-4 h-4 rounded border-b-default bg-input text-blue-600 focus:ring-blue-500 focus:ring-offset-0" />
          <label htmlFor="acepta_marketing" className="text-sm text-t-secondary">
            El paciente acepta recibir comunicaciones de marketing
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button formAction={crearPaciente}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/25">
            Guardar paciente
          </button>
          <Link href={backHref}
            className="px-6 py-2.5 bg-card border border-b-default text-t-secondary hover:text-t-primary rounded-lg transition-colors">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
