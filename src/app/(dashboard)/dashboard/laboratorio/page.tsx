import { obtenerOrdenesLaboratorio } from "./actions";
import { obtenerLaboratoriosActivos } from "./actions";
import KanbanBoard, { LabItem, LabEstado } from "./kanban-board";
import ListaPDFButton from "./lista-pdf-button";

export default async function LaboratorioPage() {
  const [data, labs] = await Promise.all([
    obtenerOrdenesLaboratorio(),
    obtenerLaboratoriosActivos(),
  ]);

  const items: LabItem[] = data.map((d: any) => ({
    id: d.id,
    createdAt: d.created_at,
    paciente: Array.isArray(d.paciente) ? d.paciente[0]?.nombre : d.paciente?.nombre,
    total: Number(d.total),
    estadoLab: (d.laboratorio?.estado as LabEstado) || "pendiente",
    laboratorioExterno: d.laboratorio?.laboratorio_externo || null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-t-primary">Laboratorio</h1>
          <p className="text-t-muted text-sm mt-1">Seguimiento de órdenes en laboratorio (Kanban)</p>
        </div>
        <ListaPDFButton laboratorios={labs} />
      </div>

      <KanbanBoard items={items} />
    </div>
  );
}
