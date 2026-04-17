import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import ExamenFormClient from "../../nuevo/examen-form-client";

export default async function EditarExamenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("tenant_id, sucursal_id, rol")
    .eq("id", user.id)
    .single();
  if (!perfil) redirect("/login");

  const { data: examen } = await supabase
    .from("examenes_clinicos")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", perfil.tenant_id)
    .single();

  if (!examen || examen.anulado) notFound();

  const [pacienteRes, optometristasRes] = await Promise.all([
    supabase.from("pacientes")
      .select("id, nombre, fecha_nacimiento, edad")
      .eq("id", examen.paciente_id)
      .eq("tenant_id", perfil.tenant_id)
      .single(),
    supabase.from("categorias_config")
      .select("label")
      .eq("tenant_id", perfil.tenant_id)
      .eq("modulo", "optometristas")
      .order("label"),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href={`/dashboard/pacientes/${examen.paciente_id}`}
        className="inline-flex items-center gap-1 text-sm text-t-muted hover:text-t-primary transition"
      >
        ← Volver a paciente
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-t-primary">
          Editar Examen de {pacienteRes.data?.nombre}
        </h1>
        <p className="text-t-muted text-sm mt-1">
          Actualiza los datos clínicos del examen
        </p>
      </div>

      <ExamenFormClient
        examenInicial={examen}
        pacienteInicial={pacienteRes.data}
        optometristasDisponibles={optometristasRes.data?.map((o) => o.label) || []}
      />
    </div>
  );
}
