"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { crearProforma } from "../actions";
import type { CatalogItem } from "../actions";
import { ProductAutocomplete } from "@/components/product-autocomplete";

interface Props {
  pacientes: { id: string; nombre: string }[];
  catalogo: CatalogItem[];
  defaultPacienteId?: string;
  campanaId?: string;
}

interface LineItem {
  id: string;
  catalogId: string;
  tipo_producto: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

const TIPO_LABELS: Record<string, string> = { aro: "🕶️ Aro", lente: "🔍 Lente", tratamiento: "✨ Servicio" };

function newItem(): LineItem {
  return { id: crypto.randomUUID(), catalogId: "", tipo_producto: "aro", descripcion: "", cantidad: 1, precio_unitario: 0 };
}

export default function ProformaFormClient({ pacientes, catalogo, defaultPacienteId, campanaId }: Props) {
  const [pacienteId, setPacienteId] = useState(defaultPacienteId || "");
  const [searchPatient, setSearchPatient] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchPatient), 200);
    return () => clearTimeout(t);
  }, [searchPatient]);
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const [descuento, setDescuento] = useState("");
  const [notas, setNotas] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (defaultPacienteId) {
      const p = pacientes.find(p => p.id === defaultPacienteId);
      if (p) setSearchPatient(p.nombre);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredPacientes = pacientes.filter(p => p.nombre.toLowerCase().includes(debouncedSearch.toLowerCase()));

  const selectCatalogItem = (lineId: string, itemInfo: CatalogItem | null) => {
    if (!itemInfo) {
      setItems(prev => prev.map(it => 
        it.id === lineId
          ? { ...it, catalogId: "", tipo_producto: "aro", descripcion: "", precio_unitario: 0 }
          : it
      ));
      return;
    }
    
    setItems(prev => prev.map(it =>
      it.id === lineId
        ? { ...it, catalogId: itemInfo.id, tipo_producto: itemInfo.tipo, descripcion: itemInfo.label, precio_unitario: itemInfo.precio }
        : it
    ));
  };

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(it => it.id !== id) : prev);
  };

  const subtotal = items.reduce((sum, it) => sum + it.cantidad * it.precio_unitario, 0);
  const descNum = parseFloat(descuento) || 0;
  const total = Math.max(subtotal - descNum, 0);

  const fmtCurrency = (val: number) => new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(val);

  // No need for catalogByType anymore, using ProductAutocomplete

  return (
    <form className="space-y-6">
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <input type="hidden" name="descuento" value={descNum.toString()} />
      <input type="hidden" name="items_json" value={JSON.stringify(items.map(({ catalogId, tipo_producto, descripcion, cantidad, precio_unitario }) => ({ producto_id: catalogId || null, tipo_producto, descripcion, cantidad, precio_unitario })))} />
      {campanaId && <input type="hidden" name="campana_id" value={campanaId} />}

      {/* Patient selector */}
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <label className="block text-sm font-medium text-t-secondary mb-1.5">Paciente *</label>
        <div className="relative">
          <input
            type="search"
            placeholder="Buscar por nombre..."
            value={searchPatient}
            aria-label="Buscar paciente"
            aria-autocomplete="list"
            aria-expanded={showDropdown && filteredPacientes.length > 0}
            onChange={(e) => { setSearchPatient(e.target.value); setShowDropdown(true); setActiveIndex(-1); setPacienteId(""); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => { setShowDropdown(false); setActiveIndex(-1); }, 200)}
            onKeyDown={(e) => {
              if (!showDropdown || filteredPacientes.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex(i => Math.min(i + 1, filteredPacientes.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex(i => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && activeIndex >= 0) {
                e.preventDefault();
                const p = filteredPacientes[activeIndex];
                setPacienteId(p.id); setSearchPatient(p.nombre);
                setShowDropdown(false); setActiveIndex(-1);
              } else if (e.key === "Escape") {
                setShowDropdown(false); setActiveIndex(-1);
              }
            }}
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          {showDropdown && filteredPacientes.length > 0 && (
            <div ref={dropdownRef} role="listbox" className="absolute z-20 w-full mt-1 bg-card border border-b-default rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {filteredPacientes.map((p, idx) => (
                <div
                  key={p.id}
                  role="option"
                  aria-selected={idx === activeIndex}
                  className={`px-4 py-2.5 cursor-pointer text-t-primary text-sm transition-colors ${idx === activeIndex ? "bg-blue-600 text-white" : "hover:bg-input"}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setPacienteId(p.id); setSearchPatient(p.nombre);
                    setShowDropdown(false); setActiveIndex(-1);
                  }}
                >
                  {p.nombre}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-t-primary">Productos / Servicios</h2>
            <p className="text-xs text-t-muted mt-0.5">Selecciona del catálogo o describe manualmente</p>
          </div>
          <button
            type="button"
            onClick={() => setItems(prev => [...prev, newItem()])}
            className="px-3 py-2.5 min-h-11 text-xs font-medium bg-a-green-bg text-t-green border border-a-green-border rounded-lg hover:opacity-80 transition"
          >
            + Agregar línea
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={item.id} className="p-4 bg-input/30 border border-b-subtle rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-t-muted font-medium">Línea {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-t-muted hover:text-t-red transition text-sm"
                  title="Eliminar"
                >
                  ✕ Quitar
                </button>
              </div>

              {/* Catalog Selector */}
              <div>
                <label className="block text-[10px] font-medium text-t-muted uppercase tracking-wider mb-1">Producto del catálogo</label>
                <ProductAutocomplete
                  items={catalogo}
                  value={item.catalogId}
                  onChange={(id, selectedItem) => selectCatalogItem(item.id, selectedItem)}
                />
              </div>

              {/* Details row */}
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 md:col-span-2">
                  <label className="block text-[10px] font-medium text-t-muted uppercase tracking-wider mb-1">Tipo</label>
                  <span className="block px-3 py-2 bg-input border border-b-default rounded-lg text-t-secondary text-sm">
                    {TIPO_LABELS[item.tipo_producto] ?? item.tipo_producto}
                  </span>
                </div>
                <div className="col-span-12 md:col-span-4">
                  <label className="block text-[10px] font-medium text-t-muted uppercase tracking-wider mb-1">Descripción</label>
                  <input
                    type="text"
                    value={item.descripcion}
                    onChange={(e) => updateItem(item.id, "descripcion", e.target.value)}
                    placeholder="Descripción..."
                    className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="block text-[10px] font-medium text-t-muted uppercase tracking-wider mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={item.cantidad}
                    onChange={(e) => updateItem(item.id, "cantidad", parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary text-base sm:text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="block text-[10px] font-medium text-t-muted uppercase tracking-wider mb-1">Precio</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.precio_unitario || ""}
                    onChange={(e) => updateItem(item.id, "precio_unitario", parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary text-base sm:text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="col-span-4 md:col-span-2 text-right">
                  <label className="block text-[10px] font-medium text-t-muted uppercase tracking-wider mb-1">Subtotal</label>
                  <span className="block px-3 py-2 text-t-primary text-sm font-mono font-medium">
                    {fmtCurrency(item.cantidad * item.precio_unitario)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mt-6 pt-4 border-t border-b-subtle">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-t-muted">Subtotal</span>
                <span className="text-t-primary font-mono">{fmtCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm items-center gap-3">
                <span className="text-t-muted">Descuento</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={descuento}
                  onChange={(e) => setDescuento(e.target.value)}
                  placeholder="0.00"
                  className="w-24 px-2 py-1 bg-input border border-b-default rounded text-t-primary text-base sm:text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div className="flex justify-between text-base font-bold pt-2 border-t border-b-subtle">
                <span className="text-t-primary">Total</span>
                <span className="text-t-blue font-mono">{fmtCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <label className="block text-sm font-medium text-t-secondary mb-1.5">Notas</label>
        <textarea
          name="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          placeholder="Notas adicionales, instrucciones especiales..."
          className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none text-base sm:text-sm"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          formAction={crearProforma}
          className="px-6 py-2.5 min-h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/25"
        >
          Guardar Proforma
        </button>
        <Link
          href="/dashboard/ventas"
          className="px-6 py-2.5 min-h-11 bg-card border border-b-default text-t-secondary hover:text-t-primary rounded-lg transition-colors inline-flex items-center"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
