"use client";

import { useState, useTransition, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { actualizarEstadoLaboratorio, obtenerDatosSobreLaboratorio } from "./actions";
import { fmtFechaCorta } from "@/lib/date-sv";
import { generarSobreLaboratorioPDF } from "./sobre-pdf";
import KanbanModal from "./kanban-modal";

// Types
export type LabEstado = "pendiente" | "en_laboratorio" | "recibido" | "entregado";

export interface LabItem {
  id: string; // orden_id
  createdAt: string; // created_at of order
  estadoAt: string; // updated_at of latest lab estado
  paciente: string;
  total: number;
  estadoLab: LabEstado;
  laboratorioExterno: string | null;
  laboratorioNombre: string | null;
}

const COLUMNAS: { id: LabEstado; title: string; color: string; icon: string }[] = [
  { id: "pendiente", title: "Pendiente", color: "border-t-amber", icon: "⏳" },
  { id: "en_laboratorio", title: "En Laboratorio", color: "border-t-blue", icon: "🔬" },
  { id: "recibido", title: "Recibido", color: "border-t-green", icon: "📦" },
  { id: "entregado", title: "Entregado", color: "border-t-green", icon: "✅" },
];

// Número de días que se muestran en la columna "Entregado".
// Cambia este valor para ajustar la ventana de tiempo visible.
const DIAS_ENTREGADO_VISIBLE = 5;

export default function KanbanBoard({ items: initialItems }: { items: LabItem[] }) {
  const [items, setItems] = useState<LabItem[]>(initialItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedOrdenId, setSelectedOrdenId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const sensors = useSensors(
    // delay+tolerance previene que iOS confunda scroll vertical con drag
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const activeItem = items.find((item) => item.id === activeId);
    if (!activeItem) return;

    // Check if we dropped on a column directly
    const isOverColumn = COLUMNAS.some((col) => col.id === overId);
    
    // Check if we dropped on another item
    const overItem = items.find((item) => item.id === overId);
    
    const newEstado: LabEstado = isOverColumn 
      ? (overId as LabEstado) 
      : overItem 
        ? overItem.estadoLab 
        : activeItem.estadoLab;

    if (activeItem.estadoLab !== newEstado) {
      // Optimistic update
      setItems((prev) =>
        prev.map((item) =>
          item.id === activeItem.id ? { ...item, estadoLab: newEstado } : item
        )
      );

      // Server update
      startTransition(async () => {
        try {
          await actualizarEstadoLaboratorio(activeItem.id, newEstado);
        } catch (e) {
          console.error("Error updating state", e);
          // Revert on error
          setItems(initialItems);
        }
      });
    }
  };

  const getActiveItem = () => items.find((item) => item.id === activeId);

  // Mover ítem a estado adyacente (alternativa táctil al drag en mobile)
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
      collisionDetection={closestCorners}
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
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeId ? <ItemCard item={getActiveItem()!} isOverlay /> : null}
      </DragOverlay>

      <KanbanModal 
        isOpen={!!selectedOrdenId} 
        onClose={() => setSelectedOrdenId(null)} 
        ordenId={selectedOrdenId} 
      />
    </DndContext>
  );
}

// ── Column ──────────────────────────────────────────────
import { useDroppable } from "@dnd-kit/core";

function Column({ id, title, color, icon, items, totalCount, diasFiltro, onCardClick, onMoveItem }: { id: string; title: string; color: string; icon: string; items: LabItem[]; totalCount: number; diasFiltro?: number; onCardClick: (id: string) => void; onMoveItem: (id: string, estado: LabEstado) => void }) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`bg-card/50 border-t-2 ${color} border border-b-default rounded-xl p-3 min-h-[400px] flex flex-col shadow-[var(--shadow-card)]`}
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
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableItem key={item.id} item={item} onCardClick={onCardClick} onMoveItem={onMoveItem} />
          ))}
        </SortableContext>
        
        {items.length === 0 && (
          <div className="h-full flex items-center justify-center border-2 border-dashed border-b-subtle rounded-lg text-t-muted text-xs p-4 text-center mt-2">
            Soltar aquí
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sortable Item wrapper ───────────────────────────────
function SortableItem({ item, onCardClick, onMoveItem }: { item: LabItem; onCardClick: (id: string) => void; onMoveItem: (id: string, estado: LabEstado) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ItemCard item={item} onClick={() => onCardClick(item.id)} onMoveItem={onMoveItem} />
    </div>
  );
}

function PrintEnvelopeButton({ ordenId, isOverlay }: { ordenId: string, isOverlay?: boolean }) {
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
      onPointerDown={(e) => e.stopPropagation()} // prevent DnD start
      disabled={loading || isOverlay}
      className="ml-1.5 px-1.5 py-0.5 text-[9px] font-medium bg-card border border-b-default rounded text-t-secondary hover:text-t-primary hover:bg-input transition disabled:opacity-50 shrink-0"
    >
      {loading ? "..." : "🖨️"}
    </button>
  );
}

// ── Card Presentation ───────────────────────────────────
const NEXT_ESTADO: Partial<Record<LabEstado, LabEstado>> = {
  pendiente: "en_laboratorio",
  en_laboratorio: "recibido",
  recibido: "entregado",
};
const NEXT_LABEL: Partial<Record<LabEstado, string>> = {
  en_laboratorio: "En Lab →",
  recibido: "Recibido →",
  entregado: "Entregado ✓",
};

function ItemCard({ item, isOverlay, onClick, onMoveItem }: { item: LabItem; isOverlay?: boolean; onClick?: () => void; onMoveItem?: (id: string, estado: LabEstado) => void }) {
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
      {/* Row 1: date + amount */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-t-muted">
          {fmtFechaCorta(item.createdAt)}
        </span>
        <span className="text-[10px] font-mono font-bold text-t-blue">{fmtCurrency(item.total)}</span>
      </div>

      {/* Row 2: patient name */}
      <p className="text-xs font-bold text-t-primary line-clamp-1 mt-0.5">{item.paciente}</p>

      {/* Row 3: lab name + print button */}
      <div className="flex justify-between items-center mt-1">
        <p className="text-[10px] text-t-muted line-clamp-1 flex-1 min-w-0">
          {item.laboratorioNombre
            ? `🔬 ${item.laboratorioNombre}`
            : item.laboratorioExterno
            ? item.laboratorioExterno
            : ""}
        </p>
        <PrintEnvelopeButton ordenId={item.id} isOverlay={isOverlay} />
      </div>

      {/* Mobile quick-move button (solo en pantallas pequeñas, solo cuando no es overlay) */}
      {!isOverlay && onMoveItem && nextEstado && (
        <button
          className="sm:hidden mt-2 w-full py-1 text-[10px] font-semibold bg-a-blue-bg text-t-blue border border-a-blue-border rounded-md hover:opacity-80 transition"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onMoveItem(item.id, nextEstado); }}
          aria-label={`Mover a ${NEXT_LABEL[nextEstado]}`}
        >
          {NEXT_LABEL[nextEstado]}
        </button>
      )}
    </div>
  );
}
