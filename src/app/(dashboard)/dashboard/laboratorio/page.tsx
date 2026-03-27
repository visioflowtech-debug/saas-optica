import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { puedeAcceder } from "@/lib/acceso";
import { obtenerOrdenesLaboratorio, obtenerLaboratoriosActivos, obtenerCampanasParaFiltro } from "./actions";
import KanbanBoard, { LabItem, LabEstado } from "./kanban-board";
import ListaPDFButton from "./lista-pdf-button";

export default async function LaboratorioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (!puedeAcceder(perfil?.rol ?? "", "laboratorio")) redirect("/dashboard");

  const [data, labs, campanas] = await Promise.all([
    obtenerOrdenesLaboratorio(),
    obtenerLaboratoriosActivos(),
    obtenerCampanasParaFiltro(),
  ]);

  const items: LabItem[] = data.map((d: any) => ({
    id: d.id,
    createdAt: d.created_at,
    estadoAt: d.laboratorio?.updated_at || d.created_at,
    paciente: Array.isArray(d.paciente) ? d.paciente[0]?.nombre : d.paciente?.nombre,
    total: Number(d.total),
    estadoLab: (d.laboratorio?.estado as LabEstado) || "pendiente",
    laboratorioExterno: d.laboratorio?.laboratorio_externo || null,
    laboratorioNombre: d.laboratorioNombre || null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-t-primary">Laboratorio</h1>
          <p className="text-t-muted text-sm mt-1">Seguimiento de órdenes en laboratorio (Kanban)</p>
        </div>
        <div className="flex items-center gap-2">
          <ListaPDFButton laboratorios={labs} campanas={campanas} />
        </div>
      </div>

      <KanbanBoard items={items} />
    </div>
  );
}
