import { obtenerOrdenesLaboratorio, obtenerLaboratoriosActivos, obtenerCampanasParaFiltro } from "./actions";
import KanbanBoard, { LabItem, LabEstado } from "./kanban-board";
import ListaPDFButton from "./lista-pdf-button";
import CampanasBackLink from "@/components/campanas-back-link";

export default async function LaboratorioPage() {
  const [data, labs, campanas] = await Promise.all([
    obtenerOrdenesLaboratorio(),
    obtenerLaboratoriosActivos(),
    obtenerCampanasParaFiltro(),
  ]);

  const items: LabItem[] = data.map((d: any) => ({
    id: d.id,
    createdAt: d.created_at,
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
          <CampanasBackLink />
          <ListaPDFButton laboratorios={labs} campanas={campanas} />
        </div>
      </div>

      <KanbanBoard items={items} />
    </div>
  );
}
