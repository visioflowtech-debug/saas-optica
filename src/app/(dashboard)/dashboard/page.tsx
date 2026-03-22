import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch real counts
  const [
    { count: totalPacientes },
    { count: totalExamenes },
    { count: totalOrdenes },
  ] = await Promise.all([
    supabase.from("pacientes").select("*", { count: "exact", head: true }),
    supabase
      .from("examenes_clinicos")
      .select("*", { count: "exact", head: true }),
    supabase.from("ordenes").select("*", { count: "exact", head: true }),
  ]);

  // Recent patients
  const { data: recientes } = await supabase
    .from("pacientes")
    .select("id, nombre, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const stats = [
    {
      label: "Pacientes",
      value: totalPacientes ?? 0,
      icon: "👥",
      color: "from-blue-500 to-blue-600",
    },
    {
      label: "Exámenes",
      value: totalExamenes ?? 0,
      icon: "🔬",
      color: "from-purple-500 to-purple-600",
    },
    {
      label: "Órdenes",
      value: totalOrdenes ?? 0,
      icon: "📋",
      color: "from-emerald-500 to-emerald-600",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Resumen general de tu óptica
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="p-6 rounded-xl"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-3xl">{s.icon}</span>
              <span
                className={`px-3 py-1 text-xs font-bold bg-gradient-to-r ${s.color} text-white rounded-full`}
              >
                {s.value}
              </span>
            </div>
            <p className="font-semibold mt-3" style={{ color: "var(--text-primary)" }}>
              {s.label}
            </p>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Total registrados
            </p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Nuevo paciente", href: "/dashboard/pacientes/nuevo", icon: "👤" },
            { label: "Nuevo examen", href: "/dashboard/examenes/nuevo", icon: "🔬" },
            { label: "Nueva venta", href: "/dashboard/ventas", icon: "💰" },
            { label: "Ver laboratorio", href: "/dashboard/laboratorio", icon: "🔧" },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center gap-3 p-4 rounded-xl transition-colors"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
              }}
            >
              <span className="text-xl">{a.icon}</span>
              <span className="text-sm font-medium">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent patients */}
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Pacientes recientes
        </h2>
        {recientes && recientes.length > 0 ? (
          <div
            className="rounded-xl divide-y overflow-hidden"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {recientes.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/pacientes/${p.id}`}
                className="flex items-center gap-3 p-4 transition-colors"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: "var(--gradient-avatar)" }}
                >
                  {p.nombre.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>
                  {p.nombre}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(p.created_at).toLocaleDateString("es-SV")}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div
            className="rounded-xl p-8 text-center text-sm"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              color: "var(--text-muted)",
            }}
          >
            No hay pacientes registrados. ¡Crea el primer paciente!
          </div>
        )}
      </div>
    </div>
  );
}
