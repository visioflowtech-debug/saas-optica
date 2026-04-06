import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ExamenFormClient from "./examen-form-client";
import { obtenerOptometristas } from "../../configuracion/optometristas-actions";
import { buscarPacientes } from "../../pacientes/actions";

export default async function NuevoExamenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; paciente_id?: string; campana_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios").select("tenant_id, sucursal_id").eq("id", user.id).single();
  if (!perfil) redirect("/login");

  // Solo carga el paciente por defecto si viene pre-seleccionado (ej: desde campaña)
  const [defaultPacienteRes, optometristas] = await Promise.all([
    params.paciente_id
      ? supabase.from("pacientes").select("id, nombre")
          .eq("id", params.paciente_id).eq("tenant_id", perfil.tenant_id).single()
      : Promise.resolve({ data: null }),
    obtenerOptometristas(),
  ]);

  const backHref = params.campana_id
    ? `/dashboard/campanas/${params.campana_id}`
    : "/dashboard/examenes";
  const backLabel = params.campana_id ? "← Volver a campaña" : "← Volver a exámenes";

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-t-muted hover:text-t-primary transition"
      >
        {backLabel}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-t-primary">Nuevo Examen Clínico</h1>
        <p className="text-t-muted text-sm mt-1">
          Registrar examen de optometría con refracción
        </p>
      </div>

      {params.error && (
        <div className="p-3 bg-a-red-bg border border-a-red-border rounded-lg text-t-red text-sm">
          {params.error}
        </div>
      )}

      <ExamenFormClient
        buscarPacientes={buscarPacientes}
        defaultPaciente={defaultPacienteRes.data}
        optometristas={optometristas}
        campanaId={params.campana_id}
      />
    </div>
  );
}
