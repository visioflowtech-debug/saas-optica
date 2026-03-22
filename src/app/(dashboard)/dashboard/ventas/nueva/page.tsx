import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { obtenerCatalogo } from "../actions";
import ProformaFormClient from "./proforma-form-client";

export default async function NuevaProformaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; paciente_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: pacientes }, catalogo] = await Promise.all([
    supabase.from("pacientes").select("id, nombre").order("nombre", { ascending: true }),
    obtenerCatalogo(),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/dashboard/ventas" className="inline-flex items-center gap-1 text-sm text-t-muted hover:text-t-primary transition">
        ← Volver a ventas
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-t-primary">Nueva Proforma</h1>
        <p className="text-t-muted text-sm mt-1">Crear cotización para un paciente</p>
      </div>

      {params.error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {params.error}
        </div>
      )}

      <ProformaFormClient
        pacientes={pacientes ?? []}
        catalogo={catalogo}
        defaultPacienteId={params.paciente_id}
      />
    </div>
  );
}
