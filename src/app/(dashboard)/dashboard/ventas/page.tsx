import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import CampanasBackLink from "@/components/campanas-back-link";
import { fmtFecha } from "@/lib/date-sv";

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase
    .from("ordenes")
    .select("*, paciente:pacientes!ordenes_paciente_id_fkey(nombre), asesor:usuarios!ordenes_asesor_id_fkey(nombre)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (params.filtro === "proforma") query = query.eq("tipo", "proforma");
  if (params.filtro === "orden_trabajo") query = query.eq("tipo", "orden_trabajo");

  const { data: ordenes } = await query;

  // Filter by patient name client-side (simple approach)
  const q = params.q?.toLowerCase() ?? "";
  const filtered = (ordenes ?? []).filter((o) => {
    const nombre = getNested(o.paciente);
    return !q || nombre.toLowerCase().includes(q);
  });

  const currentFilter = params.filtro ?? "todas";

  const filterTabs = [
    { key: "todas", label: "Todas", href: "/dashboard/ventas" },
    { key: "proforma", label: "Proformas", href: "/dashboard/ventas?filtro=proforma" },
    { key: "orden_trabajo", label: "Órdenes de Trabajo", href: "/dashboard/ventas?filtro=orden_trabajo" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-t-primary">Ventas</h1>
          <p className="text-t-muted text-sm mt-1">Gestión de proformas y órdenes de trabajo</p>
        </div>
        <div className="flex items-center gap-2">
          <CampanasBackLink />
          <Link
            href="/dashboard/ventas/nueva"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/25"
          >
            + Nueva Proforma
          </Link>
        </div>
      </div>

      {/* Search */}
      <form className="flex gap-3">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Buscar por paciente..."
          className="flex-1 px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary placeholder:text-t-muted focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm"
        />
        {params.filtro && <input type="hidden" name="filtro" value={params.filtro} />}
        <button
          type="submit"
          className="px-4 py-2.5 bg-card border border-b-default rounded-lg text-t-secondary hover:text-t-primary transition text-sm"
        >
          Buscar
        </button>
      </form>

      {/* Filter Tabs */}
      <div className="flex gap-1 p-1 bg-card border border-b-default rounded-lg w-fit">
        {filterTabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${
              currentFilter === tab.key
                ? "bg-blue-600 text-white shadow-sm"
                : "text-t-muted hover:text-t-primary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Orders Table */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-b-default rounded-xl p-12 text-center text-t-muted text-sm shadow-[var(--shadow-card)]">
          No hay ventas registradas{q ? ` para "${params.q}"` : ""}
        </div>
      ) : (
        <div className="bg-card border border-b-default rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-b-subtle">
                <th className="text-left px-5 py-3 text-xs font-medium text-t-muted uppercase tracking-wider">Paciente</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-t-muted uppercase tracking-wider">Tipo</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-t-muted uppercase tracking-wider">Estado</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-t-muted uppercase tracking-wider">Total</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-t-muted uppercase tracking-wider">Asesor</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-t-muted uppercase tracking-wider">Fecha</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-b-subtle">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-input/50 transition">
                  <td className="px-5 py-3 text-t-primary font-medium">{getNested(o.paciente)}</td>
                  <td className="px-5 py-3">
                    <TipoBadge tipo={o.tipo} />
                  </td>
                  <td className="px-5 py-3">
                    <EstadoBadge estado={o.estado} />
                  </td>
                  <td className="px-5 py-3 text-right text-t-primary font-mono font-medium">
                    {new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(Number(o.total))}
                  </td>
                  <td className="px-5 py-3 text-t-secondary">{getNested(o.asesor)}</td>
                  <td className="px-5 py-3 text-t-muted text-xs">
                    {fmtFecha(o.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/ventas/${o.id}`} className="text-xs text-t-blue hover:underline">
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function getNested(rel: { nombre: string } | { nombre: string }[] | null): string {
  if (!rel) return "—";
  if (Array.isArray(rel)) return rel[0]?.nombre ?? "—";
  return rel.nombre;
}

function TipoBadge({ tipo }: { tipo: string }) {
  const isProforma = tipo === "proforma";
  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium uppercase rounded-full ${
      isProforma ? "bg-a-amber-bg text-t-amber" : "bg-a-blue-bg text-t-blue"
    }`}>
      {isProforma ? "Proforma" : "Orden"}
    </span>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    borrador: "bg-badge-bg text-t-muted",
    confirmada: "bg-a-blue-bg text-t-blue",
    facturada: "bg-a-green-bg text-t-green",
    cancelada: "bg-a-red-bg text-t-red",
  };
  const labels: Record<string, string> = {
    borrador: "Borrador",
    confirmada: "Confirmada",
    facturada: "Facturada",
    cancelada: "Cancelada",
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium uppercase rounded-full ${map[estado] ?? map.borrador}`}>
      {labels[estado] ?? estado}
    </span>
  );
}
