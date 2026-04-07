import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signout } from "@/app/(auth)/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { SucursalSwitcher } from "@/components/sucursal-switcher";
import MobileNav from "@/components/mobile-nav";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("nombre, rol, sucursal_id, tenant_id, activo")
    .eq("id", user.id)
    .single();

  if (perfil && perfil.activo === false) redirect("/suspended");

  const [sucursalActual, sucursalesPermitidas] = perfil?.tenant_id
    ? await Promise.all([
        supabase.from("sucursales")
          .select("id, nombre, activa, campanas_activas")
          .eq("id", perfil.sucursal_id)
          .single()
          .then(({ data }) => data),
        (async () => {
          // Admins ven todas las sucursales activas del tenant
          // Otros usuarios ven solo sus sucursales asignadas en usuario_sucursales
          const rolActual = perfil.rol || "asesor_visual";
          if (rolActual === "administrador") {
            const { data } = await supabase.from("sucursales")
              .select("id, nombre, activa, campanas_activas")
              .eq("tenant_id", perfil.tenant_id)
              .eq("activa", true)
              .order("nombre");
            return data || [];
          } else {
            const { data: asignaciones } = await supabase
              .from("usuario_sucursales")
              .select("sucursal:sucursales(id, nombre, activa, campanas_activas)")
              .eq("usuario_id", user.id);
            return (asignaciones || [])
              .map((a) => (Array.isArray(a.sucursal) ? a.sucursal[0] : a.sucursal))
              .filter(Boolean) as { id: string; nombre: string; activa: boolean; campanas_activas: boolean }[];
          }
        })(),
      ])
    : [null, []];

  const todasLasSucursales = sucursalesPermitidas;
  const sucursalNombre = sucursalActual?.nombre || "Sin sucursal";
  const campanasActivas = sucursalActual?.campanas_activas ?? false;

  const nombre = perfil?.nombre || user.email || "Usuario";
  const rol = perfil?.rol || "asesor_visual";

  const rolLabels: Record<string, string> = {
    administrador: "Administrador",
    optometrista:  "Optometrista",
    asesor_visual: "Asesor Visual",
    laboratorio:   "Laboratorio",
    contador:      "Contador",
  };

  // Módulos visibles por rol — administrador ve todo
  const modulosRol: Record<string, string[]> = {
    administrador: ["inicio", "campanas", "pacientes", "examenes", "ventas", "laboratorio", "inventario", "gastos", "cuentas", "configuracion"],
    optometrista:  ["inicio", "campanas", "pacientes", "examenes", "laboratorio"],
    asesor_visual: ["inicio", "campanas", "pacientes", "ventas", "inventario", "gastos"],
    laboratorio:   ["inicio", "laboratorio"],
    contador:      ["inicio", "campanas", "ventas", "inventario", "gastos"],
  };
  const acceso = new Set(modulosRol[rol] ?? modulosRol.asesor_visual);

  const todosLosModulos = [
    { key: "inicio",         href: "/dashboard",               label: "Inicio",         icon: "🏠" },
    { key: "campanas",       href: "/dashboard/campanas",       label: "Campañas",       icon: "📍" },
    { key: "pacientes",      href: "/dashboard/pacientes",      label: "Pacientes",      icon: "👥" },
    { key: "examenes",       href: "/dashboard/examenes",       label: "Exámenes",       icon: "🔬" },
    { key: "ventas",         href: "/dashboard/ventas",         label: "Ventas",         icon: "💰" },
    { key: "laboratorio",    href: "/dashboard/laboratorio",    label: "Laboratorio",    icon: "🔧" },
    { key: "inventario",     href: "/dashboard/inventario",     label: "Inventario",     icon: "📦" },
    { key: "gastos",         href: "/dashboard/gastos",         label: "Gastos",         icon: "📋" },
    { key: "cuentas",        href: "/dashboard/cuentas",        label: "Cuentas",        icon: "🏦" },
    { key: "configuracion",  href: "/dashboard/configuracion",  label: "Configuración",  icon: "⚙️" },
  ];

  const navItems = todosLosModulos.filter((m) => {
    if (!acceso.has(m.key)) return false;
    if (m.key === "campanas" && !campanasActivas) return false;
    return true;
  });

  return (
    <div className="flex flex-col app-layout" style={{ background: "var(--bg-body)", height: "100dvh" }}>
      {/* Mobile top bar + drawer */}
      <MobileNav
        navItems={navItems}
        nombre={nombre}
        rol={rolLabels[rol] || rol}
        sucursalNombre={sucursalNombre}
        sucursales={todasLasSucursales}
        sucursalActualId={perfil?.sucursal_id || ""}
      />

      {/* Sidebar — desktop only */}
      <aside
        className="desktop-sidebar w-64 flex-col shrink-0"
        style={{
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-default)",
        }}
      >
        <div
          className="p-6"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <div className="flex items-center justify-between">
            <h2
              className="text-lg font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Óptica Nueva Imagen
            </h2>
            <ThemeToggle />
          </div>
          <SucursalSwitcher
            sucursales={todasLasSucursales}
            sucursalActualId={perfil?.sucursal_id || ""}
            sucursalActualNombre={sucursalNombre}
          />
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="nav-link flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors"
              style={{ color: "var(--text-secondary)" }}
            >
              <span className="text-base" aria-hidden="true">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
        <div
          className="p-4"
          style={{ borderTop: "1px solid var(--border-default)" }}
        >
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ background: "var(--gradient-avatar)" }}
            >
              {nombre.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-sm font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {nombre}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {rolLabels[rol] || rol}
              </p>
            </div>
          </div>
          <form>
            <button
              formAction={signout}
              className="w-full px-3 py-2.5 min-h-11 text-sm rounded-lg transition-colors text-left"
              style={{ color: "var(--text-muted)" }}
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto min-h-0">
        <div className="p-4 md:p-8">{children}</div>
      </main>

      <style>{`
        .nav-link:hover {
          background: var(--bg-card-hover);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
