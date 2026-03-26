import type { Metadata } from "next";
import { signup } from "../actions";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Crear Cuenta",
  description: "Crea tu cuenta en Óptica Nueva Imagen",
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
      className="min-h-screen flex items-center justify-center relative"
      style={{ background: "var(--bg-body)" }}
    >
      {/* Theme toggle in corner */}
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
            Crear Cuenta
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
            Registra tu cuenta en Óptica Nueva Imagen
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
          <div>
            <label
              htmlFor="nombre"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Nombre completo
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
              minLength={6}
              placeholder="••••••••"
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
            Crear Cuenta
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
