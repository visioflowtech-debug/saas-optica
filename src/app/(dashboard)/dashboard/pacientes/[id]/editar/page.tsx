import { actualizarPaciente, obtenerProfesiones } from "../../actions";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import ProfesionCombobox from "@/components/profesion-combobox";
import EtiquetasMedicasInput from "@/components/etiquetas-medicas-input";
import DobEdadInput from "@/components/dob-edad-input";

export default async function EditarPacientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios").select("tenant_id").eq("id", user.id).single();
  if (!perfil) redirect("/login");

  const { data: paciente, error } = await supabase
    .from("pacientes").select("*").eq("id", id).eq("tenant_id", perfil.tenant_id).single();
  if (error || !paciente) notFound();

  const etiquetasActuales = Array.isArray(paciente.etiquetas_medicas)
    ? (paciente.etiquetas_medicas as string[]).join(", ")
    : "";

  const profesionesList = await obtenerProfesiones();

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href={`/dashboard/pacientes/${id}`} className="inline-flex items-center gap-1 text-sm text-t-muted hover:text-t-primary transition">
        ← Volver al perfil
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-t-primary">Editar Paciente</h1>
        <p className="text-t-muted text-sm mt-1">{paciente.nombre}</p>
      </div>

      <form className="space-y-6 p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <input type="hidden" name="id" value={id} />

        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-t-secondary mb-1.5">Nombre completo *</label>
          <input id="nombre" name="nombre" type="text" required
            defaultValue={paciente.nombre}
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="telefono" className="block text-sm font-medium text-t-secondary mb-1.5">Teléfono</label>
            <input id="telefono" name="telefono" type="tel" placeholder="+503 7890-1234"
              defaultValue={paciente.telefono ?? ""}
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-t-secondary mb-1.5">Correo electrónico</label>
            <input id="email" name="email" type="email" placeholder="paciente@email.com"
              defaultValue={paciente.email ?? ""}
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
        </div>

        <DobEdadInput
          defaultDob={paciente.fecha_nacimiento ?? ""}
          defaultEdad={paciente.edad ? String(paciente.edad) : ""}
        />

        <div>
          <label htmlFor="profesion" className="block text-sm font-medium text-t-secondary mb-1.5">Profesión</label>
          <ProfesionCombobox profesionesList={profesionesList} defaultValue={paciente.profesion ?? ""} />
        </div>

        <div>
          <label className="block text-sm font-medium text-t-secondary mb-1.5">Etiquetas médicas</label>
          <EtiquetasMedicasInput defaultValue={etiquetasActuales} />
        </div>

        <div className="flex items-center gap-3">
          <input id="acepta_marketing" name="acepta_marketing" type="checkbox"
            defaultChecked={paciente.acepta_marketing ?? false}
            className="w-4 h-4 rounded border-b-default bg-input text-blue-600 focus:ring-blue-500 focus:ring-offset-0" />
          <label htmlFor="acepta_marketing" className="text-sm text-t-secondary">
            El paciente acepta recibir comunicaciones de marketing
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button formAction={actualizarPaciente}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/25">
            Guardar cambios
          </button>
          <Link href={`/dashboard/pacientes/${id}`}
            className="px-6 py-2.5 bg-card border border-b-default text-t-secondary hover:text-t-primary rounded-lg transition-colors">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
