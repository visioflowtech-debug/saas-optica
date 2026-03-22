import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { obtenerCampanas } from "./actions";
import Link from "next/link";
import { fmtDate } from "@/lib/date-sv";

export default async function CampanasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  // Verificar que la sucursal tiene campanas activas
  const { data: perfil } = await supabase
    .from("usuarios")
    .select("sucursal_id, rol")
    .eq("id", user.id)
    .single();

  const { data: suc } = await supabase
    .from("sucursales")
    .select("nombre, campanas_activas")
    .eq("id", perfil?.sucursal_id || "")
    .single();

  if (!suc?.campanas_activas) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center space-y-4">
        <div className="text-5xl">📍</div>
        <h2 className="text-xl font-bold text-t-primary">Módulo de Campañas desactivado</h2>
        <p className="text-t-muted text-sm">
          Las campañas no están habilitadas para la sucursal <strong>{suc?.nombre || "actual"}</strong>.
          Actívalas desde{" "}
          <Link href="/dashboard/configuracion" className="text-blue-400 underline">
            Configuración → Sucursales
          </Link>
          .
        </p>
      </div>
    );
  }

  const { campanas, error } = await obtenerCampanas();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-t-primary">Campañas</h1>
          <p className="text-t-secondary text-sm mt-1">
            Gestiona las campañas de atención de <strong>{suc.nombre}</strong>
          </p>
        </div>
        {perfil?.rol === "administrador" && (
          <Link
            href="/dashboard/campanas/nueva"
            className="px-4 py-2 bg-[var(--accent-blue)] hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition"
          >
            + Nueva Campaña
          </Link>
        )}
      </div>

      {params.error && (
        <div className="p-3 bg-a-red-bg border border-a-red-border rounded-lg text-t-red text-sm">
          {params.error}
        </div>
      )}

      {error && (
        <div className="p-3 bg-a-red-bg border border-a-red-border rounded-lg text-t-red text-sm">
          Error: {error}
        </div>
      )}

      {campanas.length === 0 ? (
        <div className="py-24 text-center border-2 border-dashed border-b-subtle rounded-2xl">
          <p className="text-4xl mb-3">📍</p>
          <p className="text-t-muted text-sm">No hay campañas creadas aún.</p>
          {perfil?.rol === "administrador" && (
            <Link
              href="/dashboard/campanas/nueva"
              className="inline-block mt-4 px-4 py-2 bg-[var(--accent-blue)] text-white text-sm font-semibold rounded-lg hover:bg-blue-500 transition"
            >
              Crear primera campaña
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campanas.map((camp) => (
            <Link
              key={camp.id}
              href={`/dashboard/campanas/${camp.id}`}
              className="block p-5 bg-card border border-b-default rounded-xl shadow-[var(--shadow-card)] hover:border-[var(--accent-blue)] transition group"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-t-primary group-hover:text-blue-400 transition">
                  {camp.nombre}
                </h3>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    camp.activa
                      ? "bg-green-500/15 text-green-400"
                      : "bg-gray-500/15 text-t-muted"
                  }`}
                >
                  {camp.activa ? "Activa" : "Cerrada"}
                </span>
              </div>
              {camp.descripcion && (
                <p className="text-xs text-t-muted mb-3 line-clamp-2">{camp.descripcion}</p>
              )}
              <div className="flex gap-3 text-[10px] text-t-muted">
                {camp.fecha_inicio && (
                  <span>
                    Desde {fmtDate(camp.fecha_inicio)}
                  </span>
                )}
                {camp.fecha_fin && (
                  <span>
                    Hasta {fmtDate(camp.fecha_fin)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
