import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { fmtFecha } from "@/lib/date-sv";
import { puedeAcceder } from "@/lib/acceso";

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; q?: string; pagina?: string; orden?: string; campana?: string }>;
}) {
  const params = await searchParams;
  const pagina = Math.max(1, parseInt(params.pagina ?? "1") || 1);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("tenant_id, sucursal_id, rol, sucursal:sucursales(items_por_pagina)")
    .eq("id", user.id)
    .single();
  if (!perfil) redirect("/login");
  if (!puedeAcceder(perfil.rol, "ventas")) redirect("/dashboard");

  const sucursalCfg = Array.isArray(perfil.sucursal) ? perfil.sucursal[0] : perfil.sucursal;
  const PER_PAGE = Math.max(5, (sucursalCfg as any)?.items_por_pagina ?? 25);
  const orden = params.orden === "antiguo" ? "antiguo" : "reciente";
  const from = (pagina - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  const q = params.q?.trim() ?? "";
  const campanaFiltro = params.campana ?? "";

  // Cargar campañas del tenant para el selector
  const { data: campanas } = await supabase
    .from("campanas")
    .select("id, nombre")
    .eq("tenant_id", perfil.tenant_id)
    .order("nombre");

  // Si hay filtro de campaña, obtener pacientes de esa campaña
  let campanaPatientIds: string[] | null = null;
  if (campanaFiltro) {
    const { data: pacs } = await supabase
      .from("pacientes")
      .select("id")
      .eq("campana_id", campanaFiltro)
      .eq("tenant_id", perfil.tenant_id);
    campanaPatientIds = (pacs ?? []).map((p) => p.id);
  }

  // Si hay búsqueda por nombre, resolver a IDs de paciente
  let pacienteIds: string[] | null = null;
  if (q) {
    let pacQuery = supabase
      .from("pacientes")
      .select("id")
      .eq("tenant_id", perfil.tenant_id)
      .ilike("nombre", `%${q}%`)
      .limit(200);
    // Si también hay filtro de campaña, acotar la búsqueda a esos pacientes
    if (campanaPatientIds !== null && campanaPatientIds.length > 0)
      pacQuery = pacQuery.in("id", campanaPatientIds);
    const { data: pacs } = await pacQuery;
    pacienteIds = (pacs ?? []).map((p) => p.id);
  }

  // Query paginada (tabla)
  let query = supabase
    .from("ordenes")
    .select("id, tipo, estado, total, created_at, paciente:pacientes!ordenes_paciente_id_fkey(nombre), asesor:usuarios!ordenes_asesor_id_fkey(nombre)", { count: "exact" })
    .eq("tenant_id", perfil.tenant_id)
    .eq("sucursal_id", perfil.sucursal_id)
    .order("created_at", { ascending: orden === "antiguo" })
    .range(from, to);

  // Query KPI: mismos filtros sin paginación
  let kpiQuery = supabase
    .from("ordenes")
    .select("total, tipo, estado")
    .eq("tenant_id", perfil.tenant_id)
    .eq("sucursal_id", perfil.sucursal_id);

  // Aplicar filtros comunes a ambas queries
  if (params.filtro === "proforma") { query = query.eq("tipo", "proforma"); kpiQuery = kpiQuery.eq("tipo", "proforma"); }
  if (params.filtro === "orden_trabajo") { query = query.eq("tipo", "orden_trabajo"); kpiQuery = kpiQuery.eq("tipo", "orden_trabajo"); }
  if (campanaFiltro) {
    if (!campanaPatientIds || campanaPatientIds.length === 0) {
      query = query.eq("campana_id", campanaFiltro);
      kpiQuery = kpiQuery.eq("campana_id", campanaFiltro);
    } else {
      const orFilter = `campana_id.eq.${campanaFiltro},paciente_id.in.(${campanaPatientIds.join(",")})`;
      query = query.or(orFilter);
      kpiQuery = kpiQuery.or(orFilter);
    }
  }
  if (pacienteIds !== null) {
    if (pacienteIds.length === 0) {
      query = query.eq("paciente_id", "00000000-0000-0000-0000-000000000000");
      kpiQuery = kpiQuery.eq("paciente_id", "00000000-0000-0000-0000-000000000000");
    } else {
      query = query.in("paciente_id", pacienteIds);
      kpiQuery = kpiQuery.in("paciente_id", pacienteIds);
    }
  }

  const [{ data: ordenes, count }, { data: kpiData }] = await Promise.all([query, kpiQuery]);
  const totalPages = Math.ceil((count ?? 0) / PER_PAGE);
  const filtered = ordenes ?? [];
  const currentFilter = params.filtro ?? "todas";

  // KPI totales
  const kpiOrdenes = kpiData ?? [];
  const totalVendido = kpiOrdenes.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const totalProformas = kpiOrdenes.filter((o) => o.tipo === "proforma").length;
  const totalOrdenesTrabajo = kpiOrdenes.filter((o) => o.tipo === "orden_trabajo").length;
  const porEstado: Record<string, number> = {};
  kpiOrdenes.forEach((o) => {
    porEstado[o.estado] = (porEstado[o.estado] ?? 0) + Number(o.total ?? 0);
  });
  const fmtMoney = (n: number) => new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(n);

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (params.filtro) p.set("filtro", params.filtro);
    if (q) p.set("q", q);
    if (campanaFiltro) p.set("campana", campanaFiltro);
    if (orden !== "reciente") p.set("orden", orden);
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    });
    const str = p.toString();
    return `/dashboard/ventas${str ? `?${str}` : ""}`;
  };

  const filterTabs = [
    { key: "todas", label: "Todas" },
    { key: "proforma", label: "Ventas" },
    { key: "orden_trabajo", label: "Órdenes de Trabajo" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-t-primary">Ventas</h1>
          <p className="text-t-muted text-sm mt-1">Gestión de proformas y órdenes de trabajo</p>
        </div>
        <Link
          href="/dashboard/ventas/nueva"
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/25 whitespace-nowrap"
        >
          + Nueva Venta
        </Link>
      </div>

      {/* KPI card */}
      <div className="p-5 bg-card border border-b-default rounded-xl shadow-[var(--shadow-card)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-t-muted uppercase tracking-wider mb-1">Total Vendido</p>
          <p className="text-3xl font-bold text-t-primary">{fmtMoney(totalVendido)}</p>
          <p className="text-xs text-t-muted mt-1">{kpiOrdenes.length} registro{kpiOrdenes.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {totalProformas > 0 && (
            <span className="px-3 py-1 text-xs bg-a-amber-bg text-t-amber rounded-full font-medium">
              Ventas: {totalProformas}
            </span>
          )}
          {totalOrdenesTrabajo > 0 && (
            <span className="px-3 py-1 text-xs bg-a-blue-bg text-t-blue rounded-full font-medium">
              Órdenes: {totalOrdenesTrabajo}
            </span>
          )}
          {Object.entries(porEstado).map(([estado, monto]) => {
            const colorMap: Record<string, string> = {
              borrador: "bg-badge-bg text-t-muted",
              confirmada: "bg-a-blue-bg text-t-blue",
              facturada: "bg-a-green-bg text-t-green",
              cancelada: "bg-a-red-bg text-t-red",
            };
            const labelMap: Record<string, string> = {
              borrador: "Borrador", confirmada: "Confirmada", facturada: "Facturada", cancelada: "Cancelada",
            };
            return (
              <span key={estado} className={`px-3 py-1 text-xs rounded-full font-medium ${colorMap[estado] ?? "bg-badge-bg text-t-muted"}`}>
                {labelMap[estado] ?? estado}: {fmtMoney(monto)}
              </span>
            );
          })}
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
        {campanaFiltro && <input type="hidden" name="campana" value={campanaFiltro} />}
        {orden !== "reciente" && <input type="hidden" name="orden" value={orden} />}
        <button
          type="submit"
          className="px-4 py-2.5 min-h-11 bg-card border border-b-default rounded-lg text-t-secondary hover:text-t-primary transition text-sm"
        >
          Buscar
        </button>
      </form>

      {/* Filter Tabs + Sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 p-1 bg-card border border-b-default rounded-lg">
          {filterTabs.map((tab) => (
            <Link
              key={tab.key}
              href={buildUrl({ filtro: tab.key === "todas" ? undefined : tab.key, pagina: undefined })}
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

        {/* Filtro por campaña */}
        {campanas && campanas.length > 0 && (
          <form className="contents">
            {params.filtro && <input type="hidden" name="filtro" value={params.filtro} />}
            {q && <input type="hidden" name="q" value={q} />}
            {orden !== "reciente" && <input type="hidden" name="orden" value={orden} />}
            <select
              name="campana"
              defaultValue={campanaFiltro}
              className="px-3 py-1.5 text-xs bg-card border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todas las campañas</option>
              {campanas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            <button type="submit" className="px-3 py-1.5 text-xs bg-card border border-b-default rounded-lg text-t-muted hover:text-t-primary transition">
              Filtrar
            </button>
          </form>
        )}

        <div className="flex gap-1 ml-auto">
          <Link href={buildUrl({ orden: undefined, pagina: undefined })}
            className={`px-3 py-2 min-h-11 flex items-center text-sm rounded-lg border transition ${
              orden === "reciente" ? "bg-blue-600 text-white border-blue-600 font-medium"
              : "bg-card border-b-default text-t-secondary hover:text-t-primary hover:bg-card-hover"
            }`}>Reciente</Link>
          <Link href={buildUrl({ orden: "antiguo", pagina: undefined })}
            className={`px-3 py-2 min-h-11 flex items-center text-sm rounded-lg border transition ${
              orden === "antiguo" ? "bg-blue-600 text-white border-blue-600 font-medium"
              : "bg-card border-b-default text-t-secondary hover:text-t-primary hover:bg-card-hover"
            }`}>Antiguo</Link>
        </div>
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-sm text-t-muted">
            Página {pagina} de {totalPages} — {count} ventas
          </p>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Link
                href={buildUrl({ pagina: String(pagina - 1) })}
                className="px-4 py-2 min-h-11 flex items-center bg-card border border-b-default text-sm text-t-secondary hover:text-t-primary rounded-lg transition"
              >
                ← Anterior
              </Link>
            )}
            {pagina < totalPages && (
              <Link
                href={buildUrl({ pagina: String(pagina + 1) })}
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
      {isProforma ? "Venta" : "Orden"}
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
