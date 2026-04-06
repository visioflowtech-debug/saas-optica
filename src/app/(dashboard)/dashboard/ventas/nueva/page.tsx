import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { obtenerCatalogo } from "../actions";
import ProformaFormClient from "./proforma-form-client";

export default async function NuevaProformaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; paciente_id?: string; campana_id?: string; examen_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios").select("tenant_id, sucursal_id").eq("id", user.id).single();
  if (!perfil) redirect("/login");

  const [{ data: pacientes }, catalogo] = await Promise.all([
    supabase.from("pacientes")
      .select("id, nombre")
      .eq("tenant_id", perfil.tenant_id)
      .eq("sucursal_id", perfil.sucursal_id)
      .order("nombre", { ascending: true })
      .limit(500),
    obtenerCatalogo(),
  ]);

  const backHref = params.campana_id
    ? `/dashboard/campanas/${params.campana_id}`
    : "/dashboard/ventas";

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-t-muted hover:text-t-primary transition">
        ← {params.campana_id ? "Volver a campaña" : "Volver a ventas"}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-t-primary">Nueva Venta</h1>
        <p className="text-t-muted text-sm mt-1">Crear nueva venta para un paciente</p>
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
        campanaId={params.campana_id}
        examenId={params.examen_id}
      />
    </div>
  );
}
