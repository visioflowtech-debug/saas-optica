import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import CampanasBackLink from "@/components/campanas-back-link";
import { fmtFecha } from "@/lib/date-sv";

export default async function ExamenesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: examenes } = await supabase
    .from("examenes_clinicos")
    .select("id, fecha_examen, rf_od_esfera, rf_od_cilindro, rf_oi_esfera, rf_oi_cilindro, paciente_id, optometrista_id")
    .order("fecha_examen", { ascending: false }).limit(50);

  const pacienteIds = [...new Set(examenes?.map((e) => e.paciente_id) ?? [])];
  const optIds = [...new Set(examenes?.map((e) => e.optometrista_id).filter(Boolean) ?? [])];

  const [{ data: pacs }, { data: opts }] = await Promise.all([
    pacienteIds.length > 0
      ? supabase.from("pacientes").select("id, nombre").in("id", pacienteIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    optIds.length > 0
      ? supabase.from("usuarios").select("id, nombre").in("id", optIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
  ]);

  const pacMap = new Map((pacs ?? []).map((p) => [p.id, p.nombre]));
  const optMap = new Map((opts ?? []).map((o) => [o.id, o.nombre]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-t-primary">Exámenes Clínicos</h1>
          <p className="text-t-muted text-sm mt-1">{examenes?.length ?? 0} exámenes registrados</p>
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
        <table className="w-full">
          <thead>
            <tr className="border-b border-b-subtle">
              <th className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase">Paciente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase hidden md:table-cell">RF OD</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase hidden md:table-cell">RF OI</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase hidden lg:table-cell">Optometrista</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-t-muted uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-b-subtle">
            {examenes && examenes.length > 0 ? (
              examenes.map((ex) => {
                const pacNombre = pacMap.get(ex.paciente_id);
                const optNombre = ex.optometrista_id ? optMap.get(ex.optometrista_id) : null;
                return (
                  <tr key={ex.id} className="hover:bg-card-hover transition">
                    <td className="px-6 py-4 text-sm text-t-primary">
                      {fmtFecha(ex.fecha_examen)}
                    </td>
                    <td className="px-6 py-4">
                      {pacNombre ? (
                        <Link href={`/dashboard/pacientes/${ex.paciente_id}`} className="text-sm text-t-blue hover:underline">{pacNombre}</Link>
                      ) : <span className="text-sm text-t-muted">—</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-t-secondary hidden md:table-cell font-mono">{fmtNum(ex.rf_od_esfera)} / {fmtNum(ex.rf_od_cilindro)}</td>
                    <td className="px-6 py-4 text-sm text-t-secondary hidden md:table-cell font-mono">{fmtNum(ex.rf_oi_esfera)} / {fmtNum(ex.rf_oi_cilindro)}</td>
                    <td className="px-6 py-4 text-sm text-t-muted hidden lg:table-cell">{optNombre || "—"}</td>
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
  );
}

function fmtNum(val: number | null): string { return val != null ? val.toFixed(2) : "—"; }
