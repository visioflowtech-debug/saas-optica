import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import CampanasBackLink from "@/components/campanas-back-link";
import { fmtFecha } from "@/lib/date-sv";

const PER_PAGE = 50;

export default async function ExamenesPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const params = await searchParams;
  const pagina = Math.max(1, parseInt(params.pagina ?? "1") || 1);
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

  const { data: examenes, count } = await supabase
    .from("examenes_clinicos")
    .select("id, fecha_examen, rf_od_esfera, rf_od_cilindro, rf_oi_esfera, rf_oi_cilindro, paciente_id, optometrista_id, paciente:pacientes!examenes_clinicos_paciente_id_fkey(nombre), optometrista:usuarios!examenes_clinicos_optometrista_id_fkey(nombre)", { count: "exact" })
    .eq("tenant_id", perfil.tenant_id)
    .eq("sucursal_id", perfil.sucursal_id)
    .eq("anulado", false)
    .order("fecha_examen", { ascending: false })
    .range(from, to);

  const totalPages = Math.ceil((count ?? 0) / PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-t-primary">Exámenes Clínicos</h1>
          <p className="text-t-muted text-sm mt-1">{count ?? 0} exámenes registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <CampanasBackLink />
          <Link href="/dashboard/examenes/nuevo"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/25">
            + Nuevo examen
          </Link>
        </div>
      </div>

      <div className="bg-card border border-b-default rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-b-subtle">
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase">Fecha</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase">Paciente</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase hidden md:table-cell">RF OD</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase hidden md:table-cell">RF OI</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase hidden lg:table-cell">Optometrista</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-t-muted uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-b-subtle">
            {examenes && examenes.length > 0 ? (
              examenes.map((ex) => {
                const pacNombre = getNested(ex.paciente);
                const optNombre = getNested(ex.optometrista);
                return (
                  <tr key={ex.id} className="hover:bg-card-hover transition">
                    <td className="px-6 py-4 text-sm text-t-primary">
                      {fmtFecha(ex.fecha_examen)}
                    </td>
                    <td className="px-6 py-4">
                      {pacNombre !== "—" ? (
                        <Link href={`/dashboard/pacientes/${ex.paciente_id}`} className="text-sm text-t-blue hover:underline">{pacNombre}</Link>
                      ) : <span className="text-sm text-t-muted">—</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-t-secondary hidden md:table-cell font-mono">{fmtNum(ex.rf_od_esfera)} / {fmtNum(ex.rf_od_cilindro)}</td>
                    <td className="px-6 py-4 text-sm text-t-secondary hidden md:table-cell font-mono">{fmtNum(ex.rf_oi_esfera)} / {fmtNum(ex.rf_oi_cilindro)}</td>
                    <td className="px-6 py-4 text-sm text-t-muted hidden lg:table-cell">{optNombre}</td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/dashboard/pacientes/${ex.paciente_id}`} className="text-xs text-t-muted hover:text-t-primary transition">Ver 360°</Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-t-muted">No hay exámenes registrados aún</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-t-muted">
            Página {pagina} de {totalPages} — {count} exámenes
          </p>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Link href={`/dashboard/examenes?pagina=${pagina - 1}`} className="px-4 py-2 min-h-11 flex items-center bg-card border border-b-default text-sm text-t-secondary hover:text-t-primary rounded-lg transition">
                ← Anterior
              </Link>
            )}
            {pagina < totalPages && (
              <Link href={`/dashboard/examenes?pagina=${pagina + 1}`} className="px-4 py-2 min-h-11 flex items-center bg-card border border-b-default text-sm text-t-secondary hover:text-t-primary rounded-lg transition">
                Siguiente →
              </Link>
            )}
          </div>
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
