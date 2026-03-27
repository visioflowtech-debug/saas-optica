import Link from "next/link";
import { signout } from "@/app/(auth)/actions";

export default function SuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg-body)" }}>
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl">🔒</div>
        <div>
          <h1 className="text-2xl font-bold text-t-primary mb-2">Cuenta suspendida</h1>
          <p className="text-t-muted text-sm">
            Tu cuenta ha sido desactivada. Contacta al administrador de tu organización para reactivarla.
          </p>
        </div>
        <form>
          <button
            formAction={signout}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
          >
            Cerrar sesión
          </button>
        </form>
        <p className="text-xs text-t-muted">
          ¿Crees que esto es un error?{" "}
          <Link href="/login" className="text-blue-400 hover:underline">
            Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
