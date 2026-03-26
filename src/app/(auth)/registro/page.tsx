import type { Metadata } from "next";
import { signup } from "../actions";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Crear Cuenta",
  description: "Registra tu óptica en el sistema de gestión",
  robots: { index: false, follow: false },
};

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main
      className="min-h-screen flex items-center justify-center relative py-8"
      style={{ background: "var(--bg-body)" }}
    >
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div
        className="w-full max-w-md p-8 rounded-2xl shadow-2xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="text-center mb-8">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Registrar Óptica
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
            Configura tu cuenta en minutos
          </p>
        </div>

        {params.error && (
          <div
            className="mb-4 p-3 rounded-lg text-sm text-center"
            style={{
              background: "var(--accent-red-bg)",
              color: "var(--accent-red-text)",
            }}
          >
            {params.error}
          </div>
        )}

        <form className="space-y-5">
          {/* Sección empresa */}
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Tu óptica
          </p>

          <div>
            <label
              htmlFor="empresa_nombre"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Nombre de la óptica
            </label>
            <input
              id="empresa_nombre"
              name="empresa_nombre"
              type="text"
              required
              placeholder="Ej. Óptica Central"
              className="w-full px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="sucursal_nombre"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Nombre de la sucursal principal
            </label>
            <input
              id="sucursal_nombre"
              name="sucursal_nombre"
              type="text"
              required
              placeholder="Ej. Sucursal Centro"
              className="w-full px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Separador */}
          <div style={{ borderTop: "1px solid var(--border-default)", marginTop: "4px" }} />
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Tu cuenta de administrador
          </p>

          <div>
            <label
              htmlFor="nombre"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Tu nombre completo
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              required
              placeholder="Tu nombre"
              className="w-full px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="tu@correo.com"
              className="w-full px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              className="w-full px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <button
            formAction={signup}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg shadow-blue-600/25"
          >
            Crear cuenta y entrar
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "var(--text-muted)" }}>
          ¿Ya tienes cuenta?{" "}
          <a href="/login" className="text-blue-500 hover:text-blue-400 transition">
            Inicia sesión
          </a>
        </p>
      </div>
    </main>
  );
}
