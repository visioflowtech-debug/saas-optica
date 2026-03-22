"use client";

import { useState, useTransition } from "react";
import { editarGasto } from "../../eliminar-actions";
import { eliminarGasto } from "../../gastos/actions";
import { CATEGORIAS_GASTO } from "../../gastos/types";

interface Gasto {
  id: string;
  concepto: string;
  categoria: string;
  monto: number;
  fecha: string;
  notas: string | null;
}

interface Props {
  gastos: Gasto[];
  campanaId: string;
  campanaActiva: boolean;
}

export default function CampanaGastosTabla({ gastos, campanaId, campanaActiva }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Gasto>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const fmtMoney = (n: number) => `$${Number(n).toLocaleString("es-SV", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });

  function startEdit(g: Gasto) {
    setEditingId(g.id);
    setEditForm({ concepto: g.concepto, categoria: g.categoria, monto: g.monto, fecha: g.fecha, notas: g.notas || "" });
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
    setError("");
  }

  function handleSave(id: string) {
    setError("");
    startTransition(async () => {
      const result = await editarGasto(id, {
        concepto: editForm.concepto || "",
        categoria: editForm.categoria || "otro",
        monto: Number(editForm.monto) || 0,
        fecha: editForm.fecha || new Date().toISOString().split("T")[0],
        notas: editForm.notas || undefined,
      });
      if (result?.error) {
        setError(result.error);
      } else {
        setEditingId(null);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este gasto? Esta acción no se puede deshacer.")) return;
    startTransition(async () => {
      await eliminarGasto(id);
    });
  }

  if (gastos.length === 0) {
    return (
      <div className="py-8 text-center text-t-muted text-sm">
        No hay gastos registrados en esta campaña.
      </div>
    );
  }

  return (
    <div className="divide-y divide-b-subtle">
      {error && (
        <div className="px-5 py-2 text-xs text-red-400 bg-red-500/10">{error}</div>
      )}
      {gastos.map((g) => {
        const catLabel = CATEGORIAS_GASTO.find((c) => c.value === g.categoria)?.label || g.categoria;
        const isEditing = editingId === g.id;

        if (isEditing) {
          return (
            <div key={g.id} className="px-5 py-4 bg-a-blue-bg/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[10px] text-t-muted uppercase tracking-wider block mb-1">Concepto</label>
                  <input
                    type="text"
                    value={editForm.concepto || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, concepto: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-card border border-b-default rounded-lg text-t-primary focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-t-muted uppercase tracking-wider block mb-1">Categoría</label>
                  <select
                    value={editForm.categoria || "otro"}
                    onChange={(e) => setEditForm((f) => ({ ...f, categoria: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-card border border-b-default rounded-lg text-t-primary focus:outline-none focus:border-blue-500"
                  >
                    {CATEGORIAS_GASTO.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-t-muted uppercase tracking-wider block mb-1">Monto ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.monto ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, monto: parseFloat(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm bg-card border border-b-default rounded-lg text-t-primary focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-t-muted uppercase tracking-wider block mb-1">Fecha</label>
                  <input
                    type="date"
                    value={editForm.fecha || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, fecha: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-card border border-b-default rounded-lg text-t-primary focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-t-muted uppercase tracking-wider block mb-1">Notas</label>
                  <input
                    type="text"
                    value={editForm.notas || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, notas: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-card border border-b-default rounded-lg text-t-primary focus:outline-none focus:border-blue-500"
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave(g.id)}
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50"
                >
                  {isPending ? "Guardando..." : "Guardar"}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs text-t-muted border border-b-default rounded-lg hover:text-t-primary transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          );
        }

        return (
          <div key={g.id} className="px-5 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-t-primary truncate">{g.concepto}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium">
                  {catLabel}
                </span>
                <span className="text-[10px] text-t-muted">{fmtDate(g.fecha)}</span>
                {g.notas && <span className="text-[10px] text-t-muted italic truncate max-w-[120px]">{g.notas}</span>}
              </div>
            </div>
            <p className="text-sm font-bold text-orange-400 shrink-0">{fmtMoney(g.monto)}</p>
            {campanaActiva && (
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => startEdit(g)}
                  disabled={isPending}
                  className="px-2 py-1 text-[10px] font-medium border border-b-default text-t-muted rounded-md hover:text-t-primary hover:border-blue-500/50 transition"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(g.id)}
                  disabled={isPending}
                  className="px-2 py-1 text-[10px] font-medium border border-red-500/30 text-t-red rounded-md hover:bg-red-500/10 transition"
                >
                  🗑
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
