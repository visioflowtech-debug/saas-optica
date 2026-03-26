import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import CampanasBackLink from "@/components/campanas-back-link";
import { fmtFecha } from "@/lib/date-sv";

const PER_PAGE = 50;

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; q?: string; pagina?: string }>;
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

  const q = params.q?.trim() ?? "";

  // Si hay búsqueda, resolverla a nivel DB buscando pacientes cuyo nombre coincide
  let pacienteIds: string[] | null = null;
  if (q) {
    const { data: pacs } = await supabase
      .from("pacientes")
      .select("id")
      .eq("tenant_id", perfil.tenant_id)
      .ilike("nombre", `%${q}%`)
      .limit(200);
    pacienteIds = (pacs ?? []).map((p) => p.id);
  }

  let query = supabase
    .from("ordenes")
    .select("id, tipo, estado, total, created_at, paciente:pacientes!ordenes_paciente_id_fkey(nombre), asesor:usuarios!ordenes_asesor_id_fkey(nombre)", { count: "exact" })
    .eq("tenant_id", perfil.tenant_id)
    .eq("sucursal_id", perfil.sucursal_id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.filtro === "proforma") query = query.eq("tipo", "proforma");
  if (params.filtro === "orden_trabajo") query = query.eq("tipo", "orden_trabajo");
  if (pacienteIds !== null) {
    if (pacienteIds.length === 0) query = query.eq("paciente_id", "00000000-0000-0000-0000-000000000000"); // sin resultados
    else query = query.in("paciente_id", pacienteIds);
  }

  const { data: ordenes, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / PER_PAGE);

  const filtered = ordenes ?? [];

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
        <label htmlFor="buscar-ventas" className="sr-only">Buscar ventas por paciente</label>
        <input
          id="buscar-ventas"
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Buscar por paciente..."
          className="flex-1 px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary placeholder:text-t-muted focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-base sm:text-sm"
        />
        {params.filtro && <input type="hidden" name="filtro" value={params.filtro} />}
        <button
          type="submit"
          className="px-4 py-2.5 min-h-11 bg-card border border-b-default rounded-lg text-t-secondary hover:text-t-primary transition text-sm"
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
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-b-subtle">
                <th scope="col" className="text-left px-5 py-3 text-xs font-medium text-t-muted uppercase tracking-wider">Paciente</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-medium text-t-muted uppercase tracking-wider">Tipo</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-medium text-t-muted uppercase tracking-wider">Estado</th>
                <th scope="col" className="text-right px-5 py-3 text-xs font-medium text-t-muted uppercase tracking-wider">Total</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-medium text-t-muted uppercase tracking-wider hidden md:table-cell">Asesor</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-medium text-t-muted uppercase tracking-wider hidden sm:table-cell">Fecha</th>
                <th scope="col" className="px-5 py-3"></th>
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
                  <td className="px-5 py-3 text-t-secondary hidden md:table-cell">{getNested(o.asesor)}</td>
                  <td className="px-5 py-3 text-t-muted text-xs hidden sm:table-cell">
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
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-t-muted">
            Página {pagina} de {totalPages} — {count} ventas
          </p>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Link
                href={`/dashboard/ventas?${params.filtro ? `filtro=${params.filtro}&` : ""}${params.q ? `q=${params.q}&` : ""}pagina=${pagina - 1}`}
                className="px-4 py-2 min-h-11 flex items-center bg-card border border-b-default text-sm text-t-secondary hover:text-t-primary rounded-lg transition"
              >
                ← Anterior
              </Link>
            )}
            {pagina < totalPages && (
              <Link
                href={`/dashboard/ventas?${params.filtro ? `filtro=${params.filtro}&` : ""}${params.q ? `q=${params.q}&` : ""}pagina=${pagina + 1}`}
                className="px-4 py-2 min-h-11 flex items-center bg-card border border-b-default text-sm text-t-secondary hover:text-t-primary rounded-lg transition"
              >
                Siguiente →
              </Link>
            )}
          </div>
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
