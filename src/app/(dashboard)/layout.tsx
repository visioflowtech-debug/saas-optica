import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signout } from "@/app/(auth)/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { SucursalSwitcher } from "@/components/sucursal-switcher";
import MobileNav from "@/components/mobile-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile from usuarios table
  const { data: perfil } = await supabase
    .from("usuarios")
    .select("nombre, rol, sucursal_id, tenant_id")
    .eq("id", user.id)
    .single();

  let sucursalNombre = "Sin sucursal";
  if (perfil?.sucursal_id) {
    const { data: suc } = await supabase
      .from("sucursales")
      .select("nombre")
      .eq("id", perfil.sucursal_id)
      .single();
    sucursalNombre = suc?.nombre || "Sin sucursal";
  }

  // Si es admin, cargar todas las sucursales del tenant para el switcher
  let todasLasSucursales: { id: string; nombre: string; activa: boolean }[] = [];
  let campanasActivas = false;
  if (perfil?.tenant_id) {
    const { data: sucursalesData } = await supabase
      .from("sucursales")
      .select("id, nombre, activa, campanas_activas")
      .eq("tenant_id", perfil.tenant_id)
      .eq("activa", true)
      .order("nombre");
    todasLasSucursales = sucursalesData || [];
    // Verificar si la sucursal actual tiene campanas activas
    const sucursalActual = sucursalesData?.find((s) => s.id === perfil.sucursal_id);
    campanasActivas = sucursalActual?.campanas_activas ?? false;
  }

  const nombre = perfil?.nombre || user.email || "Usuario";
  const rol = perfil?.rol || "asesor_visual";

  const rolLabels: Record<string, string> = {
    administrador: "Administrador",
    optometrista: "Optometrista",
    asesor_visual: "Asesor Visual",
    laboratorio: "Laboratorio",
  };

  const navItems = [
    { href: "/dashboard", label: "Inicio", icon: "🏠" },
    ...(campanasActivas ? [{ href: "/dashboard/campanas", label: "Campañas", icon: "📍" }] : []),
    { href: "/dashboard/pacientes", label: "Pacientes", icon: "👥" },
    { href: "/dashboard/examenes", label: "Exámenes", icon: "🔬" },
    { href: "/dashboard/ventas", label: "Ventas", icon: "💰" },
    { href: "/dashboard/laboratorio", label: "Laboratorio", icon: "🔧" },
    { href: "/dashboard/inventario", label: "Inventario", icon: "📦" },
    { href: "/dashboard/gastos", label: "Gastos", icon: "📋" },
    { href: "/dashboard/configuracion", label: "Configuración", icon: "⚙️" },
  ];

  return (
    <div className="flex h-screen flex-col md:flex-row" style={{ background: "var(--bg-body)" }}>
      {/* Mobile top bar + drawer */}
      <MobileNav
        navItems={navItems}
        nombre={nombre}
        rol={rolLabels[rol] || rol}
        sucursalNombre={sucursalNombre}
      />

      {/* Sidebar — desktop only */}
      <aside
        className="hidden md:flex w-64 flex-col shrink-0"
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
              <span className="text-base">{item.icon}</span>
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
              className="w-full px-3 py-2 text-sm rounded-lg transition-colors text-left"
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
