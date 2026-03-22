import { obtenerOrdenesLaboratorio } from "./actions";
import KanbanBoard, { LabItem, LabEstado } from "./kanban-board";

export default async function LaboratorioPage() {
  const data = await obtenerOrdenesLaboratorio();

  // Map to the KanbanBoard expected structure
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
      <div>
        <h1 className="text-2xl font-bold text-t-primary">Laboratorio</h1>
        <p className="text-t-muted text-sm mt-1">Seguimiento de órdenes en laboratorio (Kanban)</p>
      </div>

      <KanbanBoard items={items} />
    </div>
  );
}
