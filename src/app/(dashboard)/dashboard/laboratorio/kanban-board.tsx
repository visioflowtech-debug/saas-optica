"use client";

import { useState, useTransition, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { actualizarEstadoLaboratorio, obtenerDatosSobreLaboratorio } from "./actions";
import { fmtFechaCorta } from "@/lib/date-sv";
import { generarSobreLaboratorioPDF } from "./sobre-pdf";
import KanbanModal from "./kanban-modal";

// Types
export type LabEstado = "pendiente" | "en_laboratorio" | "recibido" | "entregado";

export interface LabItem {
  id: string;
  createdAt: string;
  estadoAt: string;
  paciente: string;
  total: number;
  estadoLab: LabEstado;
  laboratorioExterno: string | null;
  laboratorioNombre: string | null;
}

const COLUMNAS: { id: LabEstado; title: string; color: string; icon: string }[] = [
  { id: "pendiente",      title: "Pendiente",      color: "border-t-amber", icon: "⏳" },
  { id: "en_laboratorio", title: "En Laboratorio", color: "border-t-blue",  icon: "🔬" },
  { id: "recibido",       title: "Recibido",       color: "border-t-green", icon: "📦" },
  { id: "entregado",      title: "Entregado",      color: "border-t-green", icon: "✅" },
];

const DIAS_ENTREGADO_VISIBLE = 5;

// Estrategia: pointerWithin detecta el droppable bajo el cursor.
// Con solo columnas como droppables (sin SortableContext), esto siempre
// resuelve a la columna destino correcta.
const collisionDetection: CollisionDetection = (args) => {
  const pw = pointerWithin(args);
  if (pw.length > 0) return pw;
  return rectIntersection(args);
};

export default function KanbanBoard({ items: initialItems }: { items: LabItem[] }) {
  const [items, setItems] = useState<LabItem[]>(initialItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedOrdenId, setSelectedOrdenId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);
  useEffect(() => { setItems(initialItems); }, [initialItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    const activeItem = items.find((item) => item.id === active.id);
    if (!activeItem) return;

    // over.id es siempre un id de columna (solo columnas tienen useDroppable)
    const newEstado = over.id as LabEstado;
    if (!COLUMNAS.some((c) => c.id === newEstado)) return;
    if (activeItem.estadoLab === newEstado) return;

    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === activeItem.id ? { ...item, estadoLab: newEstado } : item
      )
    );

    startTransition(async () => {
      try {
        await actualizarEstadoLaboratorio(activeItem.id, newEstado);
      } catch (e) {
        console.error("Error actualizando estado", e);
        setItems(initialItems);
      }
    });
  };

  const moveItem = (ordenId: string, newEstado: LabEstado) => {
    const item = items.find((i) => i.id === ordenId);
    if (!item || item.estadoLab === newEstado) return;
    setItems((prev) => prev.map((i) => i.id === ordenId ? { ...i, estadoLab: newEstado } : i));
    startTransition(async () => {
      try {
        await actualizarEstadoLaboratorio(ordenId, newEstado);
      } catch {
        setItems(initialItems);
      }
    });
  };

  const activeItem = items.find((i) => i.id === activeId);

  if (!isMounted) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-start opacity-50">
        {COLUMNAS.map((col) => (
          <div key={col.id} className={`bg-card/50 border-t-2 ${col.color} border border-b-default rounded-xl p-3 min-h-[400px] shadow-[var(--shadow-card)]`} />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      id="kanban-context"
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-start">
        {COLUMNAS.map((col) => {
          const colItems = items.filter((item) => item.estadoLab === col.id);
          const visibleItems = col.id === "entregado"
            ? colItems.filter((item) => {
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - DIAS_ENTREGADO_VISIBLE);
                return new Date(item.estadoAt) >= cutoff;
              })
            : colItems;
          return (
            <Column
              key={col.id}
              id={col.id}
              title={col.title}
              color={col.color}
              icon={col.icon}
              items={visibleItems}
              totalCount={colItems.length}
              diasFiltro={col.id === "entregado" ? DIAS_ENTREGADO_VISIBLE : undefined}
              onCardClick={setSelectedOrdenId}
              onMoveItem={moveItem}
              isDraggingId={activeId}
            />
          );
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeItem ? <ItemCard item={activeItem} isOverlay /> : null}
      </DragOverlay>

      <KanbanModal
        isOpen={!!selectedOrdenId}
        onClose={() => setSelectedOrdenId(null)}
        ordenId={selectedOrdenId}
      />
    </DndContext>
  );
}

// ── Column — solo useDroppable, sin SortableContext ─────
function Column({
  id, title, color, icon, items, totalCount, diasFiltro, onCardClick, onMoveItem, isDraggingId,
}: {
  id: string; title: string; color: string; icon: string;
  items: LabItem[]; totalCount: number; diasFiltro?: number;
  onCardClick: (id: string) => void;
  onMoveItem: (id: string, estado: LabEstado) => void;
  isDraggingId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`border-t-2 ${color} border border-b-default rounded-xl p-3 min-h-[400px] flex flex-col shadow-[var(--shadow-card)] transition-colors ${
        isOver ? "bg-blue-500/10" : "bg-card/50"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-t-primary flex items-center gap-2">
          <span>{icon}</span> {title}
        </h3>
        <span className="text-xs font-medium text-t-muted bg-input px-2 py-0.5 rounded-full">
          {items.length}{totalCount > items.length ? `/${totalCount}` : ""}
        </span>
      </div>
      {diasFiltro !== undefined && (
        <p className="text-[10px] text-t-muted mb-3">Últimos {diasFiltro} días</p>
      )}
      {diasFiltro === undefined && <div className="mb-3" />}

      <div className="flex-1 flex flex-col gap-1.5">
        {items.map((item) => (
          <DraggableCard
            key={item.id}
            item={item}
            onCardClick={onCardClick}
            onMoveItem={onMoveItem}
            isDragging={isDraggingId === item.id}
          />
        ))}

        {items.length === 0 && (
          <div className={`h-full flex items-center justify-center border-2 border-dashed rounded-lg text-t-muted text-xs p-4 text-center mt-2 transition-colors ${
            isOver ? "border-blue-400 text-blue-400" : "border-b-subtle"
          }`}>
            Soltar aquí
          </div>
        )}
      </div>
    </div>
  );
}

// ── Draggable card — useDraggable, sin droppable propio ─
function DraggableCard({
  item, onCardClick, onMoveItem, isDragging,
}: {
  item: LabItem;
  onCardClick: (id: string) => void;
  onMoveItem: (id: string, estado: LabEstado) => void;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.35 : 1, touchAction: "none" }}
    >
      <ItemCard item={item} onClick={() => onCardClick(item.id)} onMoveItem={onMoveItem} />
    </div>
  );
}

// ── Botón imprimir sobre ────────────────────────────────
function PrintEnvelopeButton({ ordenId, isOverlay }: { ordenId: string; isOverlay?: boolean }) {
  const [loading, setLoading] = useState(false);

  const handlePrint = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOverlay) return;
    setLoading(true);
    try {
      const data = await obtenerDatosSobreLaboratorio(ordenId);
      await generarSobreLaboratorioPDF(data as any);
    } catch (err) {
      alert("Error al generar sobre: " + (err instanceof Error ? err.message : "Desconocido"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePrint}
      onPointerDown={(e) => e.stopPropagation()}
      disabled={loading || isOverlay}
      className="ml-1.5 px-1.5 py-0.5 text-[9px] font-medium bg-card border border-b-default rounded text-t-secondary hover:text-t-primary hover:bg-input transition disabled:opacity-50 shrink-0"
    >
      {loading ? "..." : "🖨️"}
    </button>
  );
}

// ── Card visual ─────────────────────────────────────────
const NEXT_ESTADO: Partial<Record<LabEstado, LabEstado>> = {
  pendiente:      "en_laboratorio",
  en_laboratorio: "recibido",
  recibido:       "entregado",
};
const NEXT_LABEL: Partial<Record<LabEstado, string>> = {
  en_laboratorio: "En Lab →",
  recibido:       "Recibido →",
  entregado:      "Entregado ✓",
};

function ItemCard({
  item, isOverlay, onClick, onMoveItem,
}: {
  item: LabItem; isOverlay?: boolean; onClick?: () => void;
  onMoveItem?: (id: string, estado: LabEstado) => void;
}) {
  const fmtCurrency = (val: number) =>
    new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(val);

  const nextEstado = NEXT_ESTADO[item.estadoLab];

  return (
    <div
      onClick={isOverlay ? undefined : onClick}
      className={`bg-card border border-b-default px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing hover:border-blue-500/50 transition-colors ${
        isOverlay ? "shadow-xl rotate-2 scale-105 border-blue-500 ring-2 ring-blue-500/20" : "shadow-sm"
      }`}
    >
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-t-muted">{fmtFechaCorta(item.createdAt)}</span>
        <span className="text-[10px] font-mono font-bold text-t-blue">{fmtCurrency(item.total)}</span>
      </div>

      <p className="text-xs font-bold text-t-primary line-clamp-1 mt-0.5">{item.paciente}</p>

      <div className="flex justify-between items-center mt-1">
        <p className="text-[10px] text-t-muted line-clamp-1 flex-1 min-w-0">
          {item.laboratorioNombre
            ? `🔬 ${item.laboratorioNombre}`
            : item.laboratorioExterno ?? ""}
        </p>
        <PrintEnvelopeButton ordenId={item.id} isOverlay={isOverlay} />
      </div>

      {!isOverlay && onMoveItem && nextEstado && (
        <button
          className="sm:hidden mt-2 w-full py-1 text-[10px] font-semibold bg-a-blue-bg text-t-blue border border-a-blue-border rounded-md hover:opacity-80 transition"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onMoveItem(item.id, nextEstado); }}
        >
          {NEXT_LABEL[nextEstado]}
        </button>
      )}
    </div>
  );
}
