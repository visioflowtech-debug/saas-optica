"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { agregarLineaProforma, eliminarLineaProforma, actualizarPrecioLinea } from "../actions";
import { ProductAutocomplete } from "@/components/product-autocomplete";
import type { CatalogItem } from "../actions";

interface LineaDetalle {
  id: string;
  tipo_producto: string;
  descripcion: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

interface Props {
  ordenId: string;
  lineasIniciales: LineaDetalle[];
  catalogo: CatalogItem[];
  descuento: number;
}

const TIPO_LABELS: Record<string, string> = {
  aro: "Aro", lente: "Lente", tratamiento: "Tratamiento",
  accesorio: "Accesorio", servicio: "Servicio", otro: "Otro",
};

export default function ProformaLineasEdit({ ordenId, lineasIniciales, catalogo, descuento }: Props) {
  const [lineas, setLineas] = useState(lineasIniciales);
  const [totales, setTotales] = useState({
    subtotal: lineasIniciales.reduce((s, l) => s + Number(l.subtotal), 0),
    total: Math.max(lineasIniciales.reduce((s, l) => s + Number(l.subtotal), 0) - descuento, 0),
  });

  // Estado para agregar nueva línea
  const [nuevoCatalogId, setNuevoCatalogId] = useState("");
  const [nuevoCatalogItem, setNuevoCatalogItem] = useState<CatalogItem | null>(null);
  const [nuevoPrecio, setNuevoPrecio] = useState(0);
  const [nuevaCantidad, setNuevaCantidad] = useState(1);

  // Estado para editar precio de línea existente
  const [editingLineaId, setEditingLineaId] = useState<string | null>(null);
  const [editingPrecio, setEditingPrecio] = useState(0);

  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(v);

  function handleSelectCatalog(id: string, item: CatalogItem | null) {
    setNuevoCatalogId(id);
    setNuevoCatalogItem(item);
    setNuevoPrecio(item?.precio ?? 0);
  }

  function handleAgregar() {
    if (!nuevoCatalogItem) { setError("Selecciona un producto del catálogo"); return; }
    if (nuevaCantidad < 1) { setError("Cantidad mínima: 1"); return; }
    setError("");

    startTransition(async () => {
      const r = await agregarLineaProforma(ordenId, {
        producto_id: nuevoCatalogId,
        tipo_producto: nuevoCatalogItem.tipo,
        descripcion: nuevoCatalogItem.label,
        cantidad: nuevaCantidad,
        precio_unitario: nuevoPrecio,
      });
      if (!r.success) { setError(r.error ?? "Error al agregar"); return; }

      setLineas((prev) => [...prev, {
        id: Date.now().toString(), // temporal — se refresca en siguiente SSR
        tipo_producto: nuevoCatalogItem.tipo,
        descripcion: nuevoCatalogItem.label,
        cantidad: nuevaCantidad,
        precio_unitario: nuevoPrecio,
        subtotal: nuevaCantidad * nuevoPrecio,
      }]);
      if ("subtotal" in r) setTotales({ subtotal: r.subtotal, total: r.total });
      // Reset form
      setNuevoCatalogId("");
      setNuevoCatalogItem(null);
      setNuevoPrecio(0);
      setNuevaCantidad(1);
    });
  }

  function handleEliminar(lineaId: string) {
    setError("");
    startTransition(async () => {
      const r = await eliminarLineaProforma(ordenId, lineaId);
      if (!r.success) { setError(r.error ?? "Error"); return; }
      setLineas((prev) => prev.filter((l) => l.id !== lineaId));
      if ("subtotal" in r) setTotales({ subtotal: r.subtotal, total: r.total });
    });
  }

  function startEditPrecio(linea: LineaDetalle) {
    setEditingLineaId(linea.id);
    setEditingPrecio(Number(linea.precio_unitario));
    setError("");
  }

  function handleGuardarPrecio(lineaId: string) {
    setError("");
    startTransition(async () => {
      const r = await actualizarPrecioLinea(ordenId, lineaId, editingPrecio);
      if (!r.success) { setError(r.error ?? "Error"); return; }
      setLineas((prev) => prev.map((l) =>
        l.id === lineaId
          ? { ...l, precio_unitario: editingPrecio, subtotal: l.cantidad * editingPrecio }
          : l
      ));
      if ("subtotal" in r) setTotales({ subtotal: r.subtotal, total: r.total });
      setEditingLineaId(null);
    });
  }

  return (
    <div className="bg-card border border-b-default rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
      <div className="px-6 py-4 border-b border-b-subtle flex items-center justify-between">
        <h2 className="text-sm font-semibold text-t-primary uppercase tracking-wider">
          Editar Productos
        </h2>
        {isPending && <Loader2 className="w-4 h-4 animate-spin text-t-muted" />}
      </div>

      {error && (
        <div className="mx-6 mt-4 px-3 py-2 text-xs text-t-red bg-a-red-bg border border-a-red-border rounded-lg">
          {error}
        </div>
      )}

      {/* Líneas existentes */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-b-subtle bg-input/40">
            <th className="text-left px-6 py-3 text-xs font-medium text-t-muted uppercase">Producto</th>
            <th className="text-center px-4 py-3 text-xs font-medium text-t-muted uppercase">Cant.</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-t-muted uppercase">Precio</th>
            <th className="text-right px-6 py-3 text-xs font-medium text-t-muted uppercase">Subtotal</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-b-subtle">
          {lineas.map((l) => (
            <tr key={l.id} className="group hover:bg-card-hover transition-colors">
              <td className="px-6 py-3">
                <span className="px-2 py-0.5 text-[10px] font-medium uppercase rounded-full bg-a-blue-bg text-t-blue border border-a-blue-border mr-2">
                  {TIPO_LABELS[l.tipo_producto] ?? l.tipo_producto}
                </span>
                <span className="text-t-primary text-sm">{l.descripcion ?? "—"}</span>
              </td>
              <td className="px-4 py-3 text-center text-t-secondary">{l.cantidad}</td>
              <td className="px-4 py-3 text-right">
                {editingLineaId === l.id ? (
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-xs text-t-muted">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      autoFocus
                      value={editingPrecio}
                      onChange={(e) => setEditingPrecio(parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleGuardarPrecio(l.id);
                        if (e.key === "Escape") setEditingLineaId(null);
                      }}
                      className="w-24 px-2 py-1 bg-input border border-blue-500 rounded-lg text-t-primary text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => handleGuardarPrecio(l.id)}
                      disabled={isPending}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition disabled:opacity-50"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setEditingLineaId(null)}
                      className="px-2 py-1 text-xs bg-card border border-b-default text-t-muted rounded-lg hover:text-t-primary transition"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditPrecio(l)}
                    title="Clic para cambiar precio (descuento por línea)"
                    className="font-mono text-t-secondary hover:text-blue-500 transition underline decoration-dotted"
                  >
                    {fmtCurrency(Number(l.precio_unitario))}
                  </button>
                )}
              </td>
              <td className="px-6 py-3 text-right font-mono font-medium text-t-primary">
                {fmtCurrency(Number(l.subtotal))}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => handleEliminar(l.id)}
                  disabled={isPending || lineas.length <= 1}
                  className="p-1.5 rounded-lg text-t-muted hover:text-t-red hover:bg-a-red-bg transition disabled:opacity-20 disabled:cursor-not-allowed"
                  title={lineas.length <= 1 ? "Debe quedar al menos un producto" : "Quitar línea"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Agregar línea */}
      <div className="px-6 py-4 border-t border-b-subtle bg-input/20 space-y-3">
        <p className="text-xs font-medium text-t-muted uppercase tracking-wider">Agregar producto</p>
        <div className="flex flex-col sm:flex-row gap-2 items-end">
          <div className="flex-1">
            <ProductAutocomplete
              items={catalogo}
              value={nuevoCatalogId}
              onChange={handleSelectCatalog}
              placeholder="Buscar en catálogo..."
            />
          </div>
          <div className="shrink-0">
            <label className="block text-[10px] text-t-muted uppercase tracking-wider mb-1">Cant.</label>
            <input
              type="number"
              min="1"
              value={nuevaCantidad}
              onChange={(e) => setNuevaCantidad(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-2 bg-input border border-b-default rounded-lg text-t-primary text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="shrink-0">
            <label className="block text-[10px] text-t-muted uppercase tracking-wider mb-1">Precio ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={nuevoPrecio || ""}
              onChange={(e) => setNuevoPrecio(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-24 px-2 py-2 bg-input border border-b-default rounded-lg text-t-primary text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <button
            onClick={handleAgregar}
            disabled={isPending || !nuevoCatalogId}
            className="flex items-center gap-1.5 px-4 py-2 min-h-10 text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition shadow-lg shadow-blue-600/25 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </div>
      </div>

      {/* Totales */}
      <div className="px-6 py-4 border-t border-b-subtle bg-input/30">
        <div className="flex justify-end">
          <div className="w-56 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-t-muted">Subtotal</span>
              <span className="text-t-primary font-mono">{fmtCurrency(totales.subtotal)}</span>
            </div>
            {descuento > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-t-muted">Descuento</span>
                <span className="text-t-red font-mono">-{fmtCurrency(descuento)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-2 border-t border-b-subtle">
              <span className="text-t-primary">Total</span>
              <span className="text-t-blue font-mono">{fmtCurrency(totales.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
