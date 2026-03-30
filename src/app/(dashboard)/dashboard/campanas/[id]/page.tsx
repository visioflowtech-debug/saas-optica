import { obtenerCampana, obtenerPacientesDeCampana, toggleCampanaActiva, obtenerVentasDeCampana, obtenerGastosDeCampana, obtenerIngresosDeCampana, obtenerPacientesPaginados, obtenerVentasPaginadas } from "../actions";
import { CATEGORIAS_GASTO } from "../../gastos/types";
import { redirect } from "next/navigation";
import Link from "next/link";
import CampanaGastosTabla from "./campana-gastos-tabla";
import { fmtFecha } from "@/lib/date-sv";
import { createClient } from "@/lib/supabase/server";

export default async function CampanaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    pag_v?: string; q_v?: string;
    pag_p?: string; q_p?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const pagV = Math.max(1, parseInt(sp.pag_v ?? "1") || 1);
  const pagP = Math.max(1, parseInt(sp.pag_p ?? "1") || 1);
  const q_v = sp.q_v?.trim() ?? "";
  const q_p = sp.q_p?.trim() ?? "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase
    .from("usuarios")
    .select("sucursal:sucursales(items_por_pagina)")
    .eq("id", user.id)
    .single();
  const sucursalCfg = Array.isArray(perfil?.sucursal) ? perfil.sucursal[0] : perfil?.sucursal;
  const DETAIL_PER_PAGE = Math.max(5, (sucursalCfg as any)?.items_por_pagina ?? 25);

  const resultado = await obtenerCampana(id);
  if (!resultado) redirect("/dashboard/campanas");

  const { campana, counts } = resultado;

  // KPIs: usar funciones originales sin paginar (limit 500)
  // Tabla paginada: usar nuevas funciones
  const [ventasKpi, gastos, pacientesPaginados, ventasPaginadas] = await Promise.all([
    obtenerVentasDeCampana(id),
    obtenerGastosDeCampana(id),
    obtenerPacientesPaginados(id, { q: q_p, pagina: pagP, perPage: DETAIL_PER_PAGE }),
    obtenerVentasPaginadas(id, { q: q_v, pagina: pagV, perPage: DETAIL_PER_PAGE }),
  ]);

  // Calcular los KPIs financieros desde los datos sin paginar
  const ventasActivas = ventasKpi.filter((v) => v.estado !== "cancelada");
  const ordenIds = ventasActivas.map((v) => v.id);
  const totalIngresos = await obtenerIngresosDeCampana(ordenIds);

  const totalVentas      = ventasActivas.reduce((s, v) => s + Number(v.total || 0), 0);
  const totalGastos      = gastos.reduce((s, g) => s + Number(g.monto || 0), 0);
  const cuentasPorCobrar = Math.max(0, totalVentas - totalIngresos);
  const utilidad         = totalIngresos - totalGastos;

  const pacientesConVenta = new Set(ventasActivas.map((v) => v.paciente_id)).size;
  const ticketPromedio    = ventasActivas.length > 0 ? totalVentas / ventasActivas.length : 0;
  const tasaConversion    = counts.totalExaminados > 0
    ? Math.round((pacientesConVenta / counts.totalExaminados) * 100)
    : 0;

  const gastosPorCategoria: Record<string, number> = {};
  gastos.forEach((g) => {
    gastosPorCategoria[g.categoria] = (gastosPorCategoria[g.categoria] || 0) + Number(g.monto);
  });

  const stats = {
    totalPacientes:    counts.totalPacientes,
    totalExaminados:   counts.totalExaminados,
    pacientesConVenta,
    totalOrdenes:      ventasActivas.length,
    totalVentas,
    totalIngresos,
    cuentasPorCobrar,
    totalGastos,
    utilidad,
    ticketPromedio,
    tasaConversion,
    gastosPorCategoria,
  };

  const fmt = (d: string) => fmtFecha(d);
  const fmtMoney = (n: number) => `$${n.toLocaleString("es-SV", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const estadoBadge: Record<string, { label: string; cls: string }> = {
    borrador:   { label: "Borrador",   cls: "bg-gray-500/15 text-t-muted" },
    confirmada: { label: "Confirmada", cls: "bg-blue-500/15 text-blue-400" },
    facturada:  { label: "Facturada",  cls: "bg-green-500/15 text-green-400" },
    cancelada:    { label: "Cancelada",  cls: "bg-red-500/15 text-red-400" },
  };

  // Helper para construir URLs preservando todos los params de sección
  const buildSectionUrl = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (q_v) p.set("q_v", q_v);
    if (q_p) p.set("q_p", q_p);
    if (pagV > 1) p.set("pag_v", String(pagV));
    if (pagP > 1) p.set("pag_p", String(pagP));
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    });
    const str = p.toString();
    return `/dashboard/campanas/${id}${str ? `?${str}` : ""}`;
  };

  const totalVentasPaginadas = ventasPaginadas.total;
  const totalPacientesPaginados = pacientesPaginados.total;

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/campanas" className="text-xs text-t-muted hover:text-t-primary transition">
            ← Campañas
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold text-t-primary">{campana.nombre}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              campana.activa ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-t-muted"
            }`}>
              {campana.activa ? "Activa" : "Cerrada"}
            </span>
          </div>
          {campana.descripcion && <p className="text-t-muted text-sm mt-1">{campana.descripcion}</p>}
          {(campana.fecha_inicio || campana.fecha_fin) && (
            <p className="text-xs text-t-muted mt-1">
              {campana.fecha_inicio && `${fmt(campana.fecha_inicio)}`}
              {campana.fecha_inicio && campana.fecha_fin && " → "}
              {campana.fecha_fin && `${fmt(campana.fecha_fin)}`}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <form>
            <button
              formAction={async () => {
                "use server";
                await toggleCampanaActiva(id, !campana.activa);
                redirect(`/dashboard/campanas/${id}`);
              }}
              className="px-3 py-1.5 text-xs border border-b-default rounded-lg text-t-muted hover:text-t-primary transition"
            >
              {campana.activa ? "Cerrar campaña" : "Reabrir campaña"}
            </button>
          </form>
        </div>
      </div>

      {/* ── Accesos rápidos ───────────────────────────────────── */}
      {campana.activa && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              href: `/dashboard/pacientes/nuevo?campana_id=${id}`,
              icon: "👤",
              label: "Nuevo Paciente",
              desc: "Registrar en campaña",
              color: "hover:border-blue-500/60 hover:bg-blue-500/5",
            },
            {
              href: `/dashboard/examenes/nuevo?campana_id=${id}`,
              icon: "🔬",
              label: "Nuevo Examen",
              desc: "Examen clínico",
              color: "hover:border-purple-500/60 hover:bg-purple-500/5",
            },
            {
              href: `/dashboard/ventas/nueva?campana_id=${id}`,
              icon: "🧾",
              label: "Nueva Proforma",
              desc: "Cotización / venta",
              color: "hover:border-green-500/60 hover:bg-green-500/5",
            },
            {
              href: `/dashboard/gastos/nuevo?campana_id=${id}`,
              icon: "📋",
              label: "Registrar Gasto",
              desc: "Costo de campaña",
              color: "hover:border-orange-500/60 hover:bg-orange-500/5",
            },
          ].map((acc) => (
            <Link
              key={acc.href}
              href={acc.href}
              className={`flex flex-col items-center justify-center gap-2 p-4 bg-card border border-b-default rounded-xl shadow-[var(--shadow-card)] transition ${acc.color} group cursor-pointer`}
            >
              <span className="text-3xl group-hover:scale-110 transition-transform">{acc.icon}</span>
              <div className="text-center">
                <p className="text-sm font-semibold text-t-primary">{acc.label}</p>
                <p className="text-[10px] text-t-muted">{acc.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── KPIs principales ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pacientes",       value: stats.totalPacientes,    icon: "👥", color: "text-blue-400" },
          { label: "Examinados",      value: stats.totalExaminados,   icon: "🔬", color: "text-purple-400" },
          { label: "Compraron",       value: stats.pacientesConVenta, icon: "🛒", color: "text-green-400" },
          { label: "Conversión",      value: `${stats.tasaConversion}%`, icon: "📊", color: "text-yellow-400" },
        ].map((k) => (
          <div key={k.label} className="p-4 bg-card border border-b-default rounded-xl text-center shadow-[var(--shadow-card)]">
            <p className="text-xl mb-1">{k.icon}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-t-muted mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Financiero — fila 1: Ventas · Ingresos · CxC ─────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Ventas totales */}
        <div className="p-5 bg-card border border-b-default rounded-xl shadow-[var(--shadow-card)]">
          <p className="text-xs text-t-muted uppercase tracking-wider mb-1">Ventas Totales</p>
          <p className="text-2xl font-bold text-blue-400">{fmtMoney(stats.totalVentas)}</p>
          <p className="text-xs text-t-muted mt-1">
            {stats.totalOrdenes} orden{stats.totalOrdenes !== 1 ? "es" : ""}
            {stats.totalOrdenes > 0 && ` · ticket prom. ${fmtMoney(stats.ticketPromedio)}`}
          </p>
        </div>

        {/* Ingresos cobrados */}
        <div className="p-5 bg-card border border-b-default rounded-xl shadow-[var(--shadow-card)]">
          <p className="text-xs text-t-muted uppercase tracking-wider mb-1">Ingresos Cobrados</p>
          <p className="text-2xl font-bold text-green-400">{fmtMoney(stats.totalIngresos)}</p>
          <p className="text-xs text-t-muted mt-1">
            {stats.totalVentas > 0
              ? `${Math.round((stats.totalIngresos / stats.totalVentas) * 100)}% cobrado`
              : "Sin ventas aún"}
          </p>
        </div>

        {/* Cuentas por cobrar */}
        <div className={`p-5 border rounded-xl shadow-[var(--shadow-card)] ${
          stats.cuentasPorCobrar > 0
            ? "bg-yellow-500/10 border-yellow-500/30"
            : "bg-card border-b-default"
        }`}>
          <p className="text-xs text-t-muted uppercase tracking-wider mb-1">Cuentas x Cobrar</p>
          <p className={`text-2xl font-bold ${stats.cuentasPorCobrar > 0 ? "text-yellow-400" : "text-t-muted"}`}>
            {fmtMoney(stats.cuentasPorCobrar)}
          </p>
          <p className="text-xs text-t-muted mt-1">
            {stats.cuentasPorCobrar > 0 ? "Saldo pendiente de clientes" : "Todo cobrado ✓"}
          </p>
        </div>
      </div>

      {/* ── Financiero — fila 2: Gastos · Utilidad ────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Gastos por categoría */}
        <div className="p-5 bg-card border border-b-default rounded-xl shadow-[var(--shadow-card)]">
          <p className="text-xs text-t-muted uppercase tracking-wider mb-1">Gastos de Campaña</p>
          <p className="text-2xl font-bold text-orange-400 mb-3">{fmtMoney(stats.totalGastos)}</p>
          <div className="space-y-1.5">
            {Object.entries(stats.gastosPorCategoria)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, monto]) => {
                const label = CATEGORIAS_GASTO.find((c) => c.value === cat)?.label || cat;
                const pct = stats.totalGastos > 0 ? Math.round((monto / stats.totalGastos) * 100) : 0;
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-[10px] text-t-muted mb-0.5">
                      <span>{label}</span>
                      <span className="font-semibold">{fmtMoney(monto)} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-empty rounded-full h-1">
                      <div className="bg-orange-400 h-1 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            {Object.keys(stats.gastosPorCategoria).length === 0 && (
              <p className="text-[10px] text-t-muted">Sin gastos registrados</p>
            )}
          </div>
        </div>

        {/* Utilidad = Ingresos − Gastos */}
        <div className={`p-5 border rounded-xl shadow-[var(--shadow-card)] ${
          stats.utilidad >= 0
            ? "bg-green-500/10 border-green-500/30"
            : "bg-red-500/10 border-red-500/30"
        }`}>
          <p className="text-xs text-t-muted uppercase tracking-wider mb-1">Utilidad / Pérdida</p>
          <p className={`text-3xl font-bold ${stats.utilidad >= 0 ? "text-green-400" : "text-red-400"}`}>
            {fmtMoney(stats.utilidad)}
          </p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-t-secondary">
              <span>Ingresos cobrados</span>
              <span className="font-semibold text-green-400">+{fmtMoney(stats.totalIngresos)}</span>
            </div>
            <div className="flex justify-between text-t-secondary">
              <span>Gastos campaña</span>
              <span className="font-semibold text-orange-400">−{fmtMoney(stats.totalGastos)}</span>
            </div>
            <div className="border-t border-b-subtle pt-2 flex justify-between font-semibold text-t-primary">
              <span>Resultado</span>
              <span className={stats.utilidad >= 0 ? "text-green-400" : "text-red-400"}>
                {fmtMoney(stats.utilidad)}
              </span>
            </div>
            {stats.cuentasPorCobrar > 0 && (
              <p className="text-[10px] text-yellow-400 mt-2">
                ⚠ Potencial si se cobra todo: {fmtMoney(stats.totalVentas - stats.totalGastos)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Detalle de Ventas ─────────────────────────────────── */}
      <div className="bg-card border border-b-default rounded-xl shadow-[var(--shadow-card)]">
        <div className="px-5 py-4 border-b border-b-subtle space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-t-primary text-sm">
              Ventas / Órdenes <span className="text-t-muted font-normal">({totalVentasPaginadas})</span>
            </h2>
            {campana.activa && (
              <Link
                href={`/dashboard/ventas/nueva?campana_id=${id}`}
                className="text-xs text-blue-400 hover:text-blue-300 transition"
              >
                + Nueva proforma
              </Link>
            )}
          </div>
          {/* Mini búsqueda ventas */}
          <form className="flex gap-2">
            {pagP > 1 && <input type="hidden" name="pag_p" value={String(pagP)} />}
            {q_p && <input type="hidden" name="q_p" value={q_p} />}
            <input type="hidden" name="pag_v" value="1" />
            <input type="search" name="q_v" defaultValue={q_v}
              placeholder="Buscar por paciente..."
              className="flex-1 text-xs px-3 py-1.5 bg-input border border-b-default rounded-lg text-t-primary placeholder:text-t-muted focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <button type="submit" className="text-xs px-3 py-1.5 bg-input border border-b-default rounded-lg text-t-muted hover:text-t-primary transition">Buscar</button>
          </form>
        </div>
        {ventasPaginadas.data.length === 0 ? (
          <div className="py-8 text-center text-t-muted text-sm">
            {q_v ? `Sin resultados para "${q_v}"` : "No hay ventas registradas en esta campaña."}
          </div>
        ) : (
          <div className="divide-y divide-b-subtle">
            {ventasPaginadas.data.map((v) => {
              const badge = estadoBadge[v.estado] || { label: v.estado, cls: "bg-gray-500/15 text-t-muted" };
              const pacNombre = v.paciente && !Array.isArray(v.paciente) ? (v.paciente as { nombre: string }).nombre : "—";
              return (
                <Link
                  key={v.id}
                  href={`/dashboard/ventas/${v.id}?from=${id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-empty transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-t-primary truncate">{pacNombre}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="text-[10px] text-t-muted capitalize">{v.tipo.replace("_", " ")}</span>
                      <span className="text-[10px] text-t-muted">{fmt(v.created_at)}</span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-green-400 shrink-0">{fmtMoney(Number(v.total))}</p>
                  <span className="text-t-muted text-xs">→</span>
                </Link>
              );
            })}
          </div>
        )}
        {/* Paginación ventas */}
        {totalVentasPaginadas > DETAIL_PER_PAGE && (
          <div className="px-5 py-3 border-t border-b-subtle flex items-center justify-between">
            <span className="text-xs text-t-muted">
              {totalVentasPaginadas} ventas{q_v && ` · "${q_v}"`}
            </span>
            <div className="flex gap-2">
              {pagV > 1 && (
                <Link href={buildSectionUrl({ pag_v: String(pagV - 1) })}
                  className="text-xs px-3 py-1.5 bg-input border border-b-default rounded-lg text-t-secondary hover:text-t-primary transition">
                  ← Anterior
                </Link>
              )}
              {pagV * DETAIL_PER_PAGE < totalVentasPaginadas && (
                <Link href={buildSectionUrl({ pag_v: String(pagV + 1) })}
                  className="text-xs px-3 py-1.5 bg-input border border-b-default rounded-lg text-t-secondary hover:text-t-primary transition">
                  Siguiente →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Gastos detallados (editables) ─────────────────────── */}
      <div className="bg-card border border-b-default rounded-xl shadow-[var(--shadow-card)]">
        <div className="px-5 py-4 border-b border-b-subtle flex items-center justify-between">
          <h2 className="font-semibold text-t-primary text-sm">
            Gastos <span className="text-t-muted font-normal">({gastos.length})</span>
          </h2>
          {campana.activa && (
            <Link
              href={`/dashboard/gastos/nuevo?campana_id=${id}`}
              className="text-xs text-blue-400 hover:text-blue-300 transition"
            >
              + Registrar gasto
            </Link>
          )}
        </div>
        <CampanaGastosTabla
          gastos={gastos}
          campanaId={id}
          campanaActiva={campana.activa}
        />
      </div>

      {/* ── Lista de pacientes ────────────────────────────────── */}
      <div className="bg-card border border-b-default rounded-xl shadow-[var(--shadow-card)]">
        <div className="px-5 py-4 border-b border-b-subtle space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-t-primary text-sm">
              Pacientes <span className="text-t-muted font-normal">({totalPacientesPaginados})</span>
            </h2>
            {campana.activa && (
              <Link href={`/dashboard/pacientes/nuevo?campana_id=${id}`}
                className="text-xs text-blue-400 hover:text-blue-300 transition">
                + Nuevo paciente
              </Link>
            )}
          </div>
          {/* Mini búsqueda pacientes */}
          <form className="flex gap-2">
            {pagV > 1 && <input type="hidden" name="pag_v" value={String(pagV)} />}
            {q_v && <input type="hidden" name="q_v" value={q_v} />}
            <input type="hidden" name="pag_p" value="1" />
            <input type="search" name="q_p" defaultValue={q_p}
              placeholder="Buscar paciente..."
              className="flex-1 text-xs px-3 py-1.5 bg-input border border-b-default rounded-lg text-t-primary placeholder:text-t-muted focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <button type="submit" className="text-xs px-3 py-1.5 bg-input border border-b-default rounded-lg text-t-muted hover:text-t-primary transition">Buscar</button>
          </form>
        </div>
        {pacientesPaginados.data.length === 0 ? (
          <div className="py-10 text-center text-t-muted text-sm">
            {q_p ? `Sin resultados para "${q_p}"` : "No hay pacientes registrados en esta campaña aún."}
          </div>
        ) : (
          <div className="divide-y divide-b-subtle">
            {pacientesPaginados.data.map((p) => (
              <Link key={p.id} href={`/dashboard/pacientes/${p.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-empty transition">
                <div>
                  <p className="text-sm font-medium text-t-primary">{p.nombre}</p>
                  <p className="text-xs text-t-muted">{p.telefono || p.email || "Sin contacto"}</p>
                </div>
                <span className="text-xs text-t-muted">
                  {fmtFecha(p.created_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
        {/* Paginación pacientes */}
        {totalPacientesPaginados > DETAIL_PER_PAGE && (
          <div className="px-5 py-3 border-t border-b-subtle flex items-center justify-between">
            <span className="text-xs text-t-muted">
              {totalPacientesPaginados} pacientes{q_p && ` · "${q_p}"`}
            </span>
            <div className="flex gap-2">
              {pagP > 1 && (
                <Link href={buildSectionUrl({ pag_p: String(pagP - 1) })}
                  className="text-xs px-3 py-1.5 bg-input border border-b-default rounded-lg text-t-secondary hover:text-t-primary transition">
                  ← Anterior
                </Link>
              )}
              {pagP * DETAIL_PER_PAGE < totalPacientesPaginados && (
                <Link href={buildSectionUrl({ pag_p: String(pagP + 1) })}
                  className="text-xs px-3 py-1.5 bg-input border border-b-default rounded-lg text-t-secondary hover:text-t-primary transition">
                  Siguiente →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
