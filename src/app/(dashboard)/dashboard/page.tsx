import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { fmtFecha } from "@/lib/date-sv";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("tenant_id, sucursal_id, rol")
    .eq("id", user.id)
    .single();

  if (!perfil) redirect("/login");

  const esAdmin = perfil.rol === "administrador";

  // Fechas de referencia para alertas
  const haceUnAnio = new Date();
  haceUnAnio.setFullYear(haceUnAnio.getFullYear() - 1);
  const haceUnAnioISO = haceUnAnio.toISOString();

  // Fetch en paralelo — KPIs básicos siempre, financieros solo para admin
  const [
    { count: totalPacientes },
    { count: totalExamenes },
    { count: totalOrdenes },
    cuentasData,
    cxcData,
    gastosData,
    recientes,
    { count: alertLentes },
    { count: alertStock },
    { count: alertRecetas },
  ] = await Promise.all([
    supabase.from("pacientes").select("*", { count: "exact", head: true })
      .eq("tenant_id", perfil.tenant_id).eq("sucursal_id", perfil.sucursal_id),
    supabase.from("examenes_clinicos").select("*", { count: "exact", head: true })
      .eq("tenant_id", perfil.tenant_id).eq("sucursal_id", perfil.sucursal_id),
    supabase.from("ordenes").select("*", { count: "exact", head: true })
      .eq("tenant_id", perfil.tenant_id).eq("sucursal_id", perfil.sucursal_id),
    esAdmin
      ? supabase.from("cuentas").select("tipo, saldo_actual")
          .eq("tenant_id", perfil.tenant_id).eq("sucursal_id", perfil.sucursal_id)
      : Promise.resolve({ data: null }),
    esAdmin
      ? supabase.from("v_cuentas_cobrar").select("saldo_pendiente")
          .eq("tenant_id", perfil.tenant_id).eq("sucursal_id", perfil.sucursal_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    esAdmin
      ? supabase.from("gastos").select("monto")
          .eq("tenant_id", perfil.tenant_id).eq("sucursal_id", perfil.sucursal_id)
          .gte("fecha", (() => { const sv = new Date(new Date().toLocaleString("en-US", { timeZone: "America/El_Salvador" })); return `${sv.getFullYear()}-${String(sv.getMonth() + 1).padStart(2, "0")}-01`; })())
      : Promise.resolve({ data: null }),
    supabase.from("pacientes").select("id, nombre, created_at")
      .eq("tenant_id", perfil.tenant_id).eq("sucursal_id", perfil.sucursal_id)
      .order("created_at", { ascending: false }).limit(5),
    // Alerta: lentes listos para entregar (estado recibido en laboratorio)
    supabase.from("laboratorio_estados").select("*", { count: "exact", head: true })
      .eq("tenant_id", perfil.tenant_id).eq("sucursal_id", perfil.sucursal_id).eq("estado", "recibido"),
    // Alerta: productos sin stock
    supabase.from("productos").select("*", { count: "exact", head: true })
      .eq("tenant_id", perfil.tenant_id).eq("activo", true).eq("maneja_stock", true).eq("stock", 0),
    // Alerta: examenes con receta >1 año (sin anular)
    supabase.from("examenes_clinicos").select("*", { count: "exact", head: true })
      .eq("tenant_id", perfil.tenant_id).eq("sucursal_id", perfil.sucursal_id)
      .eq("anulado", false).lt("fecha_examen", haceUnAnioISO),
  ]);

  const efectivo = Number((cuentasData.data ?? []).find((c: { tipo: string }) => c.tipo === "efectivo")?.saldo_actual ?? -1);
  const banco = Number((cuentasData.data ?? []).find((c: { tipo: string }) => c.tipo === "banco")?.saldo_actual ?? -1);
  const cxc = Number((cxcData as { data: { saldo_pendiente?: number } | null }).data?.saldo_pendiente ?? 0);
  const gastosMes = ((gastosData.data ?? []) as { monto: number }[]).reduce((s, g) => s + Number(g.monto), 0);

  const stats = [
    { label: "Pacientes", value: totalPacientes ?? 0, icon: "👥", color: "from-blue-500 to-blue-600" },
    { label: "Exámenes", value: totalExamenes ?? 0, icon: "🔬", color: "from-purple-500 to-purple-600" },
    { label: "Órdenes", value: totalOrdenes ?? 0, icon: "📋", color: "from-emerald-500 to-emerald-600" },
  ];

  function formatUSD(n: number) {
    return n.toLocaleString("es-SV", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  }

  const cuentasConfiguradas = (cuentasData.data ?? []).length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Resumen general de tu óptica</p>
      </div>

      {/* Cards financieras — solo administrador */}
      {esAdmin && cuentasConfiguradas && (
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            Finanzas
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Efectivo */}
            <Link href="/dashboard/cuentas"
              className="p-5 rounded-xl border transition-colors hover:border-green-500/50"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-card)" }}>
              <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-2">Efectivo</p>
              <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                {efectivo >= 0 ? formatUSD(efectivo) : "—"}
              </p>
            </Link>

            {/* Banco */}
            <Link href="/dashboard/cuentas"
              className="p-5 rounded-xl border transition-colors hover:border-blue-500/50"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-card)" }}>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2">Banco</p>
              <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                {banco >= 0 ? formatUSD(banco) : "—"}
              </p>
            </Link>

            {/* CxC */}
            <Link href="/dashboard/ventas"
              className="p-5 rounded-xl border transition-colors hover:border-yellow-500/50"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-card)" }}>
              <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide mb-2">Por cobrar</p>
              <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{formatUSD(cxc)}</p>
            </Link>

            {/* Gastos del mes */}
            <Link href="/dashboard/gastos"
              className="p-5 rounded-xl border transition-colors hover:border-red-500/50"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-card)" }}>
              <p className="text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide mb-2">Gastos del mes</p>
              <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{formatUSD(gastosMes)}</p>
            </Link>
          </div>
        </div>
      )}

      {/* Centro de alertas */}
      {(() => {
        const alertas = [
          alertLentes && alertLentes > 0
            ? { icon: "🔵", label: `${alertLentes} lente${alertLentes !== 1 ? "s" : ""} listo${alertLentes !== 1 ? "s" : ""} para entregar`, href: "/dashboard/laboratorio", color: "border-blue-500/40 bg-a-blue-bg", badge: "bg-blue-600" }
            : null,
          cxc > 0
            ? { icon: "🟡", label: `${formatUSD(cxc)} en saldo pendiente de cobro`, href: "/dashboard/ventas", color: "border-yellow-500/40 bg-a-amber-bg", badge: "bg-yellow-600" }
            : null,
          alertStock && alertStock > 0
            ? { icon: "🔴", label: `${alertStock} producto${alertStock !== 1 ? "s" : ""} sin stock`, href: "/dashboard/productos", color: "border-red-500/40 bg-a-red-bg", badge: "bg-red-600" }
            : null,
          alertRecetas && alertRecetas > 0
            ? { icon: "📅", label: `${alertRecetas} examen${alertRecetas !== 1 ? "es" : ""} con receta >1 año`, href: "/dashboard/pacientes", color: "border-amber-500/40 bg-a-amber-bg", badge: "bg-amber-600" }
            : null,
        ].filter(Boolean);

        if (alertas.length === 0) return null;
        return (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Alertas</h2>
              <span className="px-2 py-0.5 text-xs font-bold text-white rounded-full bg-red-500">{alertas.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {alertas.map((a) => a && (
                <Link key={a.href + a.label} href={a.href}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-all hover:opacity-90 ${a.color}`}>
                  <span className="text-xl shrink-0">{a.icon}</span>
                  <span className="text-sm font-medium flex-1" style={{ color: "var(--text-primary)" }}>{a.label}</span>
                  <span className="text-[10px] text-t-muted shrink-0">Ver →</span>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}

      {esAdmin && !cuentasConfiguradas && (
        <Link href="/dashboard/cuentas"
          className="flex items-center gap-3 p-4 rounded-xl border border-dashed text-sm transition-colors hover:border-blue-400"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-default)", color: "var(--text-muted)" }}>
          <span>💰</span>
          <span>Configura tus cuentas de efectivo y banco para ver el resumen financiero aquí.</span>
        </Link>
      )}

      {/* Stats grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Actividad</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="p-6 rounded-xl"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center justify-between">
                <span className="text-3xl">{s.icon}</span>
                <span className={`px-3 py-1 text-xs font-bold bg-gradient-to-r ${s.color} text-white rounded-full`}>{s.value}</span>
              </div>
              <p className="font-semibold mt-3" style={{ color: "var(--text-primary)" }}>{s.label}</p>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Total registrados</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Acciones rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Nuevo paciente", href: "/dashboard/pacientes/nuevo", icon: "👤" },
            { label: "Nuevo examen", href: "/dashboard/examenes/nuevo", icon: "🔬" },
            { label: "Nueva venta", href: "/dashboard/ventas", icon: "💰" },
            { label: "Ver laboratorio", href: "/dashboard/laboratorio", icon: "🔧" },
          ].map((a) => (
            <Link key={a.href} href={a.href}
              className="flex items-center gap-3 p-4 rounded-xl transition-colors"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
              <span className="text-xl">{a.icon}</span>
              <span className="text-sm font-medium">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent patients */}
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Pacientes recientes</h2>
        {recientes.data && recientes.data.length > 0 ? (
          <div className="rounded-xl divide-y overflow-hidden"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-card)" }}>
            {recientes.data.map((p) => (
              <Link key={p.id} href={`/dashboard/pacientes/${p.id}`}
                className="flex items-center gap-3 p-4 transition-colors"
                style={{ borderColor: "var(--border-subtle)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: "var(--gradient-avatar)" }}>
                  {p.nombre.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>{p.nombre}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtFecha(p.created_at)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl p-8 text-center text-sm"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--text-muted)" }}>
            No hay pacientes registrados. ¡Crea el primer paciente!
          </div>
        )}
      </div>
    </div>
  );
}
