import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { puedeAcceder } from "@/lib/acceso";
import { obtenerCampanas } from "./actions";
import Link from "next/link";
import { fmtDate } from "@/lib/date-sv";

function paginasVisibles(actual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, actual - 1, actual, actual + 1].filter(p => p >= 1 && p <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && (sorted[i] as number) - (sorted[i - 1] as number) > 1) result.push("…");
    result.push(sorted[i]);
  }
  return result;
}

export default async function CampanasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; pagina?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const pagina = Math.max(1, parseInt(params.pagina ?? "1") || 1);

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("sucursal_id, rol, sucursal:sucursales(nombre, campanas_activas, items_por_pagina)")
    .eq("id", user.id)
    .single();
  if (!puedeAcceder(perfil?.rol ?? "", "campanas")) redirect("/dashboard");

  const sucursalCfg = Array.isArray(perfil?.sucursal) ? perfil?.sucursal[0] : perfil?.sucursal;
  const suc = sucursalCfg as any;

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

  const PER_PAGE = Math.max(5, suc?.items_por_pagina ?? 25);
  const q = params.q?.trim() ?? "";
  const estado = ["activa", "cerrada"].includes(params.estado ?? "") ? params.estado! : "";

  const { campanas, error, total } = await obtenerCampanas({ q, estado, pagina, perPage: PER_PAGE });
  const totalPages = Math.ceil(total / PER_PAGE);

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (estado) p.set("estado", estado);
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    });
    const str = p.toString();
    return `/dashboard/campanas${str ? `?${str}` : ""}`;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-t-primary">Campañas</h1>
          <p className="text-t-secondary text-sm mt-1">
            {total} campaña{total !== 1 ? "s" : ""} · <strong>{suc.nombre}</strong>
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

      {/* Búsqueda */}
      <form className="flex gap-3">
        <input type="search" name="q" defaultValue={q}
          placeholder="Buscar campaña..."
          className="flex-1 px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary placeholder:text-t-muted focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-base sm:text-sm" />
        {estado && <input type="hidden" name="estado" value={estado} />}
        <button type="submit" className="px-4 py-2.5 min-h-11 bg-card border border-b-default rounded-lg text-t-secondary hover:text-t-primary transition text-sm">Buscar</button>
      </form>

      {/* Filter buttons */}
      <div className="flex gap-1 p-1 bg-card border border-b-default rounded-lg w-fit">
        {[{ key: "", label: "Todas" }, { key: "activa", label: "Activas" }, { key: "cerrada", label: "Cerradas" }].map((f) => (
          <Link key={f.key} href={buildUrl({ estado: f.key || undefined, pagina: undefined })}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${estado === f.key ? "bg-blue-600 text-white" : "text-t-muted hover:text-t-primary"}`}>
            {f.label}
          </Link>
        ))}
      </div>

      {campanas.length === 0 ? (
        <div className="py-24 text-center border-2 border-dashed border-b-subtle rounded-2xl">
          <p className="text-4xl mb-3">📍</p>
          <p className="text-t-muted text-sm">
            {q || estado ? "Sin resultados para esa búsqueda" : "No hay campañas creadas aún."}
          </p>
          {!q && !estado && perfil?.rol === "administrador" && (
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

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-t-muted order-2 sm:order-1">
            Página {pagina} de {totalPages} — {total} campañas
          </p>
          <nav className="flex items-center gap-1 order-1 sm:order-2" aria-label="Paginación">
            {pagina > 1 ? (
              <Link href={buildUrl({ pagina: String(pagina - 1) })}
                className="px-3 py-2 min-h-10 flex items-center text-sm bg-card border border-b-default text-t-secondary hover:text-t-primary rounded-lg transition"
                aria-label="Página anterior">←</Link>
            ) : (
              <span className="px-3 py-2 min-h-10 flex items-center text-sm text-t-muted/40 border border-b-default rounded-lg cursor-not-allowed">←</span>
            )}
            {paginasVisibles(pagina, totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`e-${i}`} className="px-2 py-2 text-sm text-t-muted">…</span>
              ) : (
                <Link key={p}
                  href={buildUrl({ pagina: p === 1 ? undefined : String(p) })}
                  className={`w-9 h-9 flex items-center justify-center text-sm rounded-lg border transition ${
                    p === pagina
                      ? "bg-blue-600 text-white border-blue-600 font-semibold"
                      : "bg-card border-b-default text-t-secondary hover:text-t-primary hover:bg-card-hover"
                  }`}
                  aria-current={p === pagina ? "page" : undefined}
                >{p}</Link>
              )
            )}
            {pagina < totalPages ? (
              <Link href={buildUrl({ pagina: String(pagina + 1) })}
                className="px-3 py-2 min-h-10 flex items-center text-sm bg-card border border-b-default text-t-secondary hover:text-t-primary rounded-lg transition"
                aria-label="Página siguiente">→</Link>
            ) : (
              <span className="px-3 py-2 min-h-10 flex items-center text-sm text-t-muted/40 border border-b-default rounded-lg cursor-not-allowed">→</span>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
