import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-4">
      <p className="text-6xl font-bold text-slate-300">404</p>
      <h1 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
        Página no encontrada
      </h1>
      <p className="text-sm text-slate-500 max-w-sm">
        La página que buscas no existe o fue movida.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
