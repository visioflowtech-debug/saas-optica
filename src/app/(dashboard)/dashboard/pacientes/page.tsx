import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import CampanasBackLink from "@/components/campanas-back-link";

function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase
    .from("pacientes")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(50);

  if (params.q) {
    query = query.or(
      `nombre.ilike.%${params.q}%,telefono.ilike.%${params.q}%,email.ilike.%${params.q}%`
    );
  }

  const { data: pacientes, count } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-t-primary">Pacientes</h1>
          <p className="text-t-muted text-sm mt-1">
            {count ?? 0} pacientes registrados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CampanasBackLink />
          <Link
            href="/dashboard/pacientes/nuevo"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/25"
          >
            + Nuevo paciente
          </Link>
        </div>
      </div>

      {params.error && (
        <div className="p-3 bg-a-red-bg border border-a-red-border rounded-lg text-t-red text-sm">
          {params.error}
        </div>
      )}

      {/* Search */}
      <form className="flex gap-3">
        <input
          type="search"
          name="q"
          defaultValue={params.q || ""}
          placeholder="Buscar por nombre, teléfono o email..."
          className="flex-1 px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm"
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-card border border-b-default rounded-lg text-t-secondary hover:text-t-primary text-sm transition hover:bg-card-hover"
        >
          Buscar
        </button>
      </form>

      {/* Patient Table */}
      <div className="bg-card border border-b-default rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-b-subtle">
              <th className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase tracking-wider">
                Paciente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase tracking-wider hidden sm:table-cell">
                Teléfono
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase tracking-wider hidden md:table-cell">
                Edad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-t-muted uppercase tracking-wider hidden lg:table-cell">
                Etiquetas
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-t-muted uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-b-subtle">
            {pacientes && pacientes.length > 0 ? (
              pacientes.map((p) => (
                <tr key={p.id} className="hover:bg-card-hover transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {p.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-t-primary">
                          {p.nombre}
                        </p>
                        {p.email && (
                          <p className="text-xs text-t-muted">{p.email}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-t-secondary hidden sm:table-cell">
                    {p.telefono || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-t-secondary hidden md:table-cell">
                    {p.fecha_nacimiento
                      ? `${calculateAge(p.fecha_nacimiento)} años`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(p.etiquetas_medicas) &&
                        (p.etiquetas_medicas as string[]).slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-[10px] font-medium bg-a-red-bg text-t-red border border-a-red-border rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/dashboard/pacientes/${p.id}`}
                      className="text-sm text-t-blue hover:underline transition"
                    >
                      Ver 360°
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-t-muted">
                  {params.q
                    ? "No se encontraron pacientes con esa búsqueda"
                    : "No hay pacientes registrados aún"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
