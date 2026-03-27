import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { puedeAcceder } from "@/lib/acceso";
import { obtenerGastos, eliminarGasto } from "./actions";
import { obtenerCategoriasGasto } from "@/app/(dashboard)/dashboard/configuracion/categorias-actions";
import Link from "next/link";
import { fmtDate } from "@/lib/date-sv";

const PAGE_SIZE = 50;

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ campana_id?: string; categoria?: string; error?: string; pagina?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (!puedeAcceder(perfil?.rol ?? "", "gastos")) redirect("/dashboard");

  const params = await searchParams;
  const pagina = Math.max(1, parseInt(params.pagina || "1", 10));

  const [{ gastos, totalMonto, porCategoria, total }, categorias] = await Promise.all([
    obtenerGastos({ campana_id: params.campana_id, categoria: params.categoria, pagina }),
    obtenerCategoriasGasto(),
  ]);

  const categoriasActivas = categorias.filter((c) => c.activo);
  const totalPaginas = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-t-primary">Gastos</h1>
          <p className="text-t-secondary text-sm mt-1">Control de gastos operativos y de campaña</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/gastos/nuevo"
            className="px-4 py-2 bg-[var(--accent-blue)] hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition"
          >
            + Registrar Gasto
          </Link>
        </div>
      </div>

      {params.error && (
        <div className="p-3 bg-a-red-bg border border-a-red-border rounded-lg text-t-red text-sm">
          {params.error}
        </div>
      )}

      {/* KPI principal */}
      <div className="p-5 bg-card border border-b-default rounded-xl shadow-[var(--shadow-card)] flex items-center justify-between">
        <div>
          <p className="text-xs text-t-muted uppercase tracking-wider mb-1">Total Gastos</p>
          <p className="text-3xl font-bold text-t-primary">${totalMonto.toFixed(2)}</p>
          <p className="text-xs text-t-muted mt-1">{total} registro{total !== 1 ? "s" : ""}</p>
        </div>
        {/* Mini breakdown por categoría */}
        <div className="flex flex-wrap gap-2 justify-end max-w-sm">
          {Object.entries(porCategoria).map(([cat, monto]) => {
            const label = categorias.find((c) => c.valor === cat)?.label || cat;
            return (
              <span key={cat} className="text-xs px-2 py-1 bg-badge border border-b-default rounded-full text-t-secondary">
                {label}: <strong>${monto.toFixed(0)}</strong>
              </span>
            );
          })}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-card border border-b-default rounded-xl shadow-[var(--shadow-card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-b-subtle flex items-center justify-between">
          <h2 className="font-semibold text-t-primary text-sm">Registros</h2>
          {/* Filtro categoría */}
          <form method="GET" className="flex items-center gap-1">
            {params.campana_id && (
              <input type="hidden" name="campana_id" value={params.campana_id} />
            )}
            <select
              name="categoria"
              defaultValue={params.categoria || ""}
              className="text-xs px-2 py-1 bg-input border border-b-default rounded text-t-primary"
            >
              <option value="">Todas las categorías</option>
              {categoriasActivas.map((c) => (
                <option key={c.valor} value={c.valor}>{c.label}</option>
              ))}
            </select>
            <button type="submit" className="text-xs px-2 py-1 bg-input border border-b-default rounded text-t-muted hover:text-t-primary transition">
              Filtrar
            </button>
          </form>
        </div>

        {gastos.length === 0 ? (
          <div className="py-16 text-center text-t-muted text-sm">
            No hay gastos registrados.{" "}
            <Link href="/dashboard/gastos/nuevo" className="text-blue-400 underline">
              Registrar el primero
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-b-subtle">
            {gastos.map((g) => (

              <div key={g.id} className="flex items-center justify-between px-5 py-3 hover:bg-empty transition">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="text-center min-w-[48px]">
                    <p className="text-xs font-bold text-t-primary">
                      {fmtDate(g.fecha, { year: undefined })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-t-primary truncate">{g.concepto}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 bg-badge border border-b-default rounded text-t-muted capitalize">
                        {categorias.find((c) => c.valor === g.categoria)?.label || g.categoria}
                      </span>
                      {g.campana && (
                        <span className="text-[10px] text-blue-400">📍 {g.campana.nombre}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm font-bold text-t-primary">${Number(g.monto).toFixed(2)}</p>
                  <form>
                    <button
                      formAction={async () => {
                        "use server";
                        await eliminarGasto(g.id);
                      }}
                      className="text-xs text-t-muted hover:text-red-400 transition px-2 py-1 rounded hover:bg-red-500/10"
                      title="Eliminar gasto"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="px-5 py-3 border-t border-b-subtle flex items-center justify-between text-sm">
            <span className="text-t-muted text-xs">
              Página {pagina} de {totalPaginas} · {total} registros
            </span>
            <div className="flex gap-2">
              {pagina > 1 && (
                <Link
                  href={`/dashboard/gastos?${new URLSearchParams({ ...(params.campana_id ? { campana_id: params.campana_id } : {}), ...(params.categoria ? { categoria: params.categoria } : {}), pagina: String(pagina - 1) })}`}
                  className="px-3 py-1.5 text-xs bg-input border border-b-default rounded-lg text-t-secondary hover:text-t-primary transition"
                >
                  ← Anterior
                </Link>
              )}
              {pagina < totalPaginas && (
                <Link
                  href={`/dashboard/gastos?${new URLSearchParams({ ...(params.campana_id ? { campana_id: params.campana_id } : {}), ...(params.categoria ? { categoria: params.categoria } : {}), pagina: String(pagina + 1) })}`}
                  className="px-3 py-1.5 text-xs bg-input border border-b-default rounded-lg text-t-secondary hover:text-t-primary transition"
                >
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
