import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ExamenFormClient from "./examen-form-client";
import { obtenerOptometristas } from "../../configuracion/optometristas-actions";

export default async function NuevoExamenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; paciente_id?: string; campana_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all patients for the selector + configured optometrists
  const [{ data: pacientes }, optometristas] = await Promise.all([
    supabase.from("pacientes").select("id, nombre").order("nombre", { ascending: true }),
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
        pacientes={pacientes ?? []}
        optometristas={optometristas}
        defaultPacienteId={params.paciente_id}
        campanaId={params.campana_id}
      />
    </div>
  );
}
