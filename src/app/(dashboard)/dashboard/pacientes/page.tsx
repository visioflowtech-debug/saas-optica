import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import CampanasBackLink from "@/components/campanas-back-link";
import PacientesSearch from "./pacientes-search";

function calcularEdad(fechaNacimiento: string): number {
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

function mostrarEdad(p: { fecha_nacimiento: string | null; edad_aproximada: number | null }): string {
  if (p.fecha_nacimiento) return `${calcularEdad(p.fecha_nacimiento)} años`;
  if (p.edad_aproximada) return `~${p.edad_aproximada} años`;
  return "—";
}

/** Paginación inteligente: siempre muestra 1, última y ±2 del actual */
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

const PER_PAGE = 25;

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string; orden?: string }>;
}) {
  const params = await searchParams;
  const pagina = Math.max(1, parseInt(params.pagina ?? "1") || 1);
  const orden = params.orden === "reciente" ? "reciente" : "nombre";
  const from = (pagina - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("tenant_id, sucursal_id")
    .eq("id", user.id)
    .single();
  if (!perfil) redirect("/login");

  let query = supabase
    .from("pacientes")
    .select(
      "id, nombre, telefono, fecha_nacimiento, edad_aproximada, etiquetas_medicas",
      { count: "exact" }
    )
    .eq("tenant_id", perfil.tenant_id)
    .eq("sucursal_id", perfil.sucursal_id)
    .range(from, to);

  if (params.q?.trim()) {
    query = query.or(
      `nombre.ilike.%${params.q.trim()}%,telefono.ilike.%${params.q.trim()}%`
    );
  }

  query = orden === "reciente"
    ? query.order("created_at", { ascending: false })
    : query.order("nombre", { ascending: true });

  const { data: pacientes, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / PER_PAGE);

  // Construir base de URL preservando filtros activos
  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (params.q?.trim()) p.set("q", params.q.trim());
    if (orden !== "nombre") p.set("orden", orden);
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    });
    const str = p.toString();
    return `/dashboard/pacientes${str ? `?${str}` : ""}`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-t-primary">Pacientes</h1>
          <p className="text-t-muted text-sm mt-0.5">
            {params.q ? `${count ?? 0} resultados` : `${count ?? 0} pacientes en esta sucursal`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CampanasBackLink />
          <Link
            href="/dashboard/pacientes/nuevo"
            className="px-4 py-2.5 min-h-11 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/25 whitespace-nowrap"
          >
            + Nuevo
          </Link>
        </div>
      </div>

      {/* Barra de búsqueda + orden */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <PacientesSearch defaultValue={params.q ?? ""} total={count ?? 0} />
        </div>

        {/* Selector de orden */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={buildUrl({ orden: undefined, pagina: undefined })}
            className={`px-3 py-2 min-h-11 flex items-center text-sm rounded-lg border transition ${
              orden === "nombre"
                ? "bg-blue-600 text-white border-blue-600 font-medium"
                : "bg-card border-b-default text-t-secondary hover:text-t-primary hover:bg-card-hover"
            }`}
          >
            A–Z
          </Link>
          <Link
            href={buildUrl({ orden: "reciente", pagina: undefined })}
            className={`px-3 py-2 min-h-11 flex items-center text-sm rounded-lg border transition ${
              orden === "reciente"
                ? "bg-blue-600 text-white border-blue-600 font-medium"
                : "bg-card border-b-default text-t-secondary hover:text-t-primary hover:bg-card-hover"
            }`}
          >
            Recientes
          </Link>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-card border border-b-default rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-b-subtle bg-input/40">
                <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-t-muted uppercase tracking-wider">
                  Paciente
                </th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-t-muted uppercase tracking-wider hidden sm:table-cell">
                  Teléfono
                </th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-t-muted uppercase tracking-wider hidden md:table-cell">
                  Edad
                </th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-t-muted uppercase tracking-wider hidden lg:table-cell">
                  Condiciones
                </th>
                <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-t-muted uppercase tracking-wider">
                  <span className="sr-only">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-b-subtle">
              {pacientes && pacientes.length > 0 ? (
                pacientes.map((p) => {
                  const initiales = p.nombre
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w: string) => w[0])
                    .join("")
                    .toUpperCase();

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-card-hover transition-colors group"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/dashboard/pacientes/${p.id}`}
                          className="flex items-center gap-3"
                        >
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {initiales}
                          </div>
                          <span className="text-sm font-medium text-t-primary group-hover:text-blue-500 transition-colors">
                            {p.nombre}
                          </span>
                        </Link>
                      </td>

                      <td className="px-5 py-3.5 text-sm text-t-secondary hidden sm:table-cell">
                        {p.telefono ? (
                          <a
                            href={`tel:${p.telefono.replace(/[^+\d]/g, "")}`}
                            className="hover:text-t-primary transition"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {p.telefono}
                          </a>
                        ) : (
                          <span className="text-t-muted">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-sm text-t-secondary hidden md:table-cell">
                        {mostrarEdad(p)}
                      </td>

                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(p.etiquetas_medicas) &&
                            (p.etiquetas_medicas as string[]).slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 text-[10px] font-medium bg-a-red-bg text-t-red border border-a-red-border rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/dashboard/pacientes/${p.id}`}
                          className="text-xs font-medium text-t-muted group-hover:text-blue-500 transition-colors"
                          tabIndex={-1}
                          aria-hidden
                        >
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-t-secondary">
                        {params.q ? "Sin resultados para esa búsqueda" : "No hay pacientes registrados"}
                      </p>
                      {params.q && (
                        <p className="text-xs text-t-muted">
                          Intenta con otro nombre o número de teléfono
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-t-muted order-2 sm:order-1">
            Mostrando {from + 1}–{Math.min(to + 1, count ?? 0)} de {count} pacientes
          </p>

          <nav className="flex items-center gap-1 order-1 sm:order-2" aria-label="Paginación">
            {/* Anterior */}
            {pagina > 1 ? (
              <Link
                href={buildUrl({ pagina: String(pagina - 1) })}
                className="px-3 py-2 min-h-10 flex items-center text-sm bg-card border border-b-default text-t-secondary hover:text-t-primary rounded-lg transition"
                aria-label="Página anterior"
              >
                ←
              </Link>
            ) : (
              <span className="px-3 py-2 min-h-10 flex items-center text-sm text-t-muted/40 border border-b-default rounded-lg cursor-not-allowed">←</span>
            )}

            {/* Páginas numeradas */}
            {paginasVisibles(pagina, totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`e-${i}`} className="px-2 py-2 text-sm text-t-muted">…</span>
              ) : (
                <Link
                  key={p}
                  href={buildUrl({ pagina: p === 1 ? undefined : String(p) })}
                  className={`w-9 h-9 flex items-center justify-center text-sm rounded-lg border transition ${
                    p === pagina
                      ? "bg-blue-600 text-white border-blue-600 font-semibold"
                      : "bg-card border-b-default text-t-secondary hover:text-t-primary hover:bg-card-hover"
                  }`}
                  aria-current={p === pagina ? "page" : undefined}
                >
                  {p}
                </Link>
              )
            )}

            {/* Siguiente */}
            {pagina < totalPages ? (
              <Link
                href={buildUrl({ pagina: String(pagina + 1) })}
                className="px-3 py-2 min-h-10 flex items-center text-sm bg-card border border-b-default text-t-secondary hover:text-t-primary rounded-lg transition"
                aria-label="Página siguiente"
              >
                →
              </Link>
            ) : (
              <span className="px-3 py-2 min-h-10 flex items-center text-sm text-t-muted/40 border border-b-default rounded-lg cursor-not-allowed">→</span>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
