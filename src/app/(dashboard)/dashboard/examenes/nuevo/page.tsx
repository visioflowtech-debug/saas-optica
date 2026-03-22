import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ExamenFormClient from "./examen-form-client";

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

  // Fetch all patients for the selector
  const { data: pacientes } = await supabase
    .from("pacientes")
    .select("id, nombre")
    .order("nombre", { ascending: true });

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/dashboard/examenes"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 transition"
      >
        ← Volver a exámenes
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-white">Nuevo Examen Clínico</h1>
        <p className="text-slate-400 text-sm mt-1">
          Registrar examen de optometría con refracción
        </p>
      </div>

      {params.error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {params.error}
        </div>
      )}

      <ExamenFormClient
        pacientes={pacientes ?? []}
        defaultPacienteId={params.paciente_id}
        campanaId={params.campana_id}
      />
    </div>
  );
}
