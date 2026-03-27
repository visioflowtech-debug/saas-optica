import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { fmtFecha } from "@/lib/date-sv";
import ExamenesSearch from "./examenes-search";

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

export default async function ExamenesPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; q?: string }>;
}) {
  const params = await searchParams;
  const pagina = Math.max(1, parseInt(params.pagina ?? "1") || 1);
  const q = params.q?.trim() ?? "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("tenant_id, sucursal_id, sucursal:sucursales(items_por_pagina)")
    .eq("id", user.id)
    .single();
  if (!perfil) redirect("/login");

  const sucursalCfg = Array.isArray(perfil.sucursal) ? perfil.sucursal[0] : perfil.sucursal;
  const PER_PAGE = Math.max(5, (sucursalCfg as any)?.items_por_pagina ?? 25);
  const from = (pagina - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  let query = supabase
    .from("examenes_clinicos")
    .select(
      "id, fecha_examen, rf_od_esfera, rf_od_cilindro, rf_oi_esfera, rf_oi_cilindro, paciente_id, optometrista_id, paciente:pacientes!examenes_clinicos_paciente_id_fkey(nombre), optometrista:usuarios!examenes_clinicos_optometrista_id_fkey(nombre)",
      { count: "exact" }
    )
    .eq("tenant_id", perfil.tenant_id)
    .eq("sucursal_id", perfil.sucursal_id)
    .eq("anulado", false)
    .order("fecha_examen", { ascending: false })
    .range(from, to);

  if (q) {
    query = query.ilike("paciente.nombre", `%${q}%`);
  }

  const { data: examenes, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / PER_PAGE);

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    });
    const str = p.toString();
    return `/dashboard/examenes${str ? `?${str}` : ""}`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-t-primary">Exámenes Clínicos</h1>
          <p className="text-t-muted text-sm mt-0.5">
            {q ? `${count ?? 0} resultados` : `${count ?? 0} exámenes registrados`}
          </p>
        </div>
        <Link href="/dashboard/examenes/nuevo"
          className="px-4 py-2.5 min-h-11 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/25 whitespace-nowrap">
          + Nuevo examen
        </Link>
      </div>

      {/* Búsqueda */}
      <ExamenesSearch defaultValue={q} total={count ?? 0} />

      {/* Tabla */}
      <div className="bg-card border border-b-default rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-b-subtle bg-input/40">
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase">Fecha</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase">Paciente</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase hidden md:table-cell">RF OD</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase hidden md:table-cell">RF OI</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase hidden lg:table-cell">Optometrista</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-t-muted uppercase"><span className="sr-only">Acción</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-b-subtle">
              {examenes && examenes.length > 0 ? (
                examenes.map((ex) => {
                  const pacNombre = getNested(ex.paciente);
                  const optNombre = getNested(ex.optometrista);
                  return (
                    <tr key={ex.id} className="hover:bg-card-hover transition">
                      <td className="px-6 py-3.5 text-sm text-t-primary">{fmtFecha(ex.fecha_examen)}</td>
                      <td className="px-6 py-3.5">
                        {pacNombre !== "—" ? (
                          <Link href={`/dashboard/pacientes/${ex.paciente_id}`} className="text-sm font-medium text-t-primary hover:text-blue-500 transition">{pacNombre}</Link>
                        ) : <span className="text-sm text-t-muted">—</span>}
                      </td>
                      <td className="px-6 py-3.5 text-sm text-t-secondary hidden md:table-cell font-mono">{fmtNum(ex.rf_od_esfera)} / {fmtNum(ex.rf_od_cilindro)}</td>
                      <td className="px-6 py-3.5 text-sm text-t-secondary hidden md:table-cell font-mono">{fmtNum(ex.rf_oi_esfera)} / {fmtNum(ex.rf_oi_cilindro)}</td>
                      <td className="px-6 py-3.5 text-sm text-t-muted hidden lg:table-cell">{optNombre}</td>
                      <td className="px-6 py-3.5 text-right">
                        <Link href={`/dashboard/pacientes/${ex.paciente_id}`} className="text-xs text-t-muted hover:text-t-primary transition">Ver 360°</Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <p className="text-sm font-medium text-t-secondary">
                      {q ? "Sin resultados para esa búsqueda" : "No hay exámenes registrados aún"}
                    </p>
                    {q && <p className="text-xs text-t-muted mt-1">Intenta con otro nombre de paciente</p>}
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
            Mostrando {from + 1}–{Math.min(to + 1, count ?? 0)} de {count} exámenes
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

function fmtNum(val: number | null): string { return val != null ? val.toFixed(2) : "—"; }

function getNested(rel: { nombre: string } | { nombre: string }[] | null): string {
  if (!rel) return "—";
  if (Array.isArray(rel)) return rel[0]?.nombre ?? "—";
  return rel.nombre;
}
