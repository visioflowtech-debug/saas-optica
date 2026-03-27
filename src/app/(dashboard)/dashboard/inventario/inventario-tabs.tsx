"use client";

import { useState, useEffect, useTransition } from "react";
import { Producto, CategoriaProducto, upsertProducto, softDeleteProducto, obtenerProductos, ajustarStock } from "./actions";
import { Search, Plus, Edit2, Trash2, PackageX, CircleSlash, X, Loader2 } from "lucide-react";

const categorias: { id: CategoriaProducto | "todo"; label: string }[] = [
  { id: "todo",          label: "Todo" },
  { id: "aro_economico", label: "Aros Económicos" },
  { id: "aro_marca",     label: "Aros de Marca" },
  { id: "aro_sol",       label: "Aros de Sol" },
  { id: "accesorio",     label: "Accesorios" },
  { id: "lente",         label: "Lentes" },
  { id: "servicio",      label: "Servicios" },
  { id: "tratamiento",   label: "Tratamientos" },
];

const CATEGORIA_LABELS: Record<string, string> = {
  aro_economico: "Aro Económico",
  aro_marca:     "Aro Marca",
  aro_sol:       "Aro Sol",
  accesorio:     "Accesorio",
  lente:         "Lente",
  servicio:      "Servicio",
  tratamiento:   "Tratamiento",
};

const PAGE_SIZE = 10;

export default function InventarioTabs({
  productosIniciales,
  totalInicial,
}: {
  productosIniciales: Producto[];
  totalInicial: number;
}) {
  const [activa, setActiva] = useState<CategoriaProducto | "todo">("todo");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [productos, setProductos] = useState(productosIniciales);
  const [total, setTotal] = useState(totalInicial);
  const [isPending, startTransition] = useTransition();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<Producto> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [newStockVal, setNewStockVal] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      startTransition(async () => {
        const { productos, total } = await obtenerProductos(activa, searchTerm, page, PAGE_SIZE);
        setProductos(productos);
        setTotal(total);
      });
    }, 350);
    return () => clearTimeout(t);
  }, [activa, searchTerm, page]);

  function openNewItem() {
    setSaveError("");
    setEditingItem({
      categoria: activa === "todo" ? "aro_economico" : activa,
      precio: 0,
      precio_costo: 0,
      maneja_stock: activa !== "todo" && activa.includes("aro"),
      stock: 0,
    });
    setModalOpen(true);
  }

  function openEditItem(p: Producto) {
    setSaveError("");
    setEditingItem(p);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    setSaving(true);
    setSaveError("");
    const result = await upsertProducto(editingItem);
    if (result.success) {
      setModalOpen(false);
      const { productos, total } = await obtenerProductos(activa, searchTerm, page, PAGE_SIZE);
      setProductos(productos);
      setTotal(total);
    } else {
      setSaveError(result.error ?? "Error al guardar");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este producto del inventario?")) return;
    const result = await softDeleteProducto(id);
    if (result.success) {
      const { productos, total } = await obtenerProductos(activa, searchTerm, page, PAGE_SIZE);
      setProductos(productos);
      setTotal(total);
    }
  }

  async function handleQuickStock(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustingId) return;
    const result = await ajustarStock(adjustingId, newStockVal);
    if (result.success) {
      setAdjustingId(null);
      const { productos } = await obtenerProductos(activa, searchTerm, page, PAGE_SIZE);
      setProductos(productos);
    }
  }

  const requiresBrand = editingItem?.categoria?.includes("aro");
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const fmt = (val: number) => `$${val.toFixed(2)}`;

  return (
    <div className="space-y-5">
      {/* Filtros por categoría */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categorias.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setActiva(cat.id); setPage(1); }}
            className={`whitespace-nowrap px-3 py-2 min-h-10 text-sm rounded-lg border transition shrink-0 ${
              activa === cat.id
                ? "bg-blue-600 text-white border-blue-600 font-medium"
                : "bg-card border-b-default text-t-secondary hover:text-t-primary hover:bg-card-hover"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Barra de búsqueda + acción */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre, marca o modelo..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 min-h-11 bg-input border border-b-default rounded-lg text-t-primary text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          {isPending && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t-muted animate-spin" />
          )}
        </div>
        <button
          onClick={openNewItem}
          className="flex items-center justify-center gap-2 px-4 py-2.5 min-h-11 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/25 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuevo Producto
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-card border border-b-default rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-b-subtle bg-input/40">
                <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-t-muted uppercase tracking-wider">
                  Producto
                </th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-t-muted uppercase tracking-wider hidden sm:table-cell">
                  Categoría
                </th>
                <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-t-muted uppercase tracking-wider hidden md:table-cell">
                  Costo
                </th>
                <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-t-muted uppercase tracking-wider">
                  Precio
                </th>
                <th scope="col" className="px-5 py-3 text-center text-xs font-medium text-t-muted uppercase tracking-wider hidden sm:table-cell">
                  Stock
                </th>
                <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-t-muted uppercase tracking-wider">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-b-subtle">
              {productos.length > 0 ? (
                productos.map((p) => (
                  <tr key={p.id} className="hover:bg-card-hover transition-colors group">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-t-primary">
                        {p.nombre ? p.nombre : [p.marca, p.modelo, p.color].filter(Boolean).join(" — ")}
                      </p>
                      {p.nombre && (p.marca || p.modelo) && (
                        <p className="text-xs text-t-muted mt-0.5">
                          {[p.marca, p.modelo, p.color].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-a-blue-bg text-t-blue border border-a-blue-border rounded-full">
                        {CATEGORIA_LABELS[p.categoria] ?? p.categoria}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right hidden md:table-cell">
                      <span className="text-sm font-mono text-t-amber">{fmt(p.precio_costo)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-mono font-semibold text-t-green">{fmt(p.precio)}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <div className="flex justify-center">
                        {p.maneja_stock ? (
                          adjustingId === p.id ? (
                            <form onSubmit={handleQuickStock} className="flex items-center gap-1">
                              <input
                                type="number"
                                autoFocus
                                value={newStockVal}
                                onChange={(e) => setNewStockVal(parseInt(e.target.value) || 0)}
                                className="w-16 px-2 py-1 bg-input border border-blue-500 rounded-lg text-xs text-center text-t-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <button type="submit" className="px-2 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition">✓</button>
                              <button type="button" onClick={() => setAdjustingId(null)} className="px-2 py-1 text-xs bg-card border border-b-default text-t-muted rounded-lg hover:text-t-primary transition">✕</button>
                            </form>
                          ) : (
                            <button
                              onClick={() => { setAdjustingId(p.id); setNewStockVal(p.stock); }}
                              title="Clic para ajustar stock"
                              className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition hover:opacity-80 ${
                                p.stock > 5
                                  ? "bg-a-green-bg text-t-green border-a-green-border"
                                  : p.stock > 0
                                  ? "bg-a-amber-bg text-t-amber border-a-amber-border"
                                  : "bg-a-red-bg text-t-red border-a-red-border"
                              }`}
                            >
                              {p.stock} uds.
                            </button>
                          )
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-t-muted">
                            <CircleSlash className="w-3 h-3" /> N/A
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditItem(p)}
                          className="p-1.5 rounded-lg text-t-muted hover:text-blue-500 hover:bg-a-blue-bg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 rounded-lg text-t-muted hover:text-t-red hover:bg-a-red-bg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <PackageX className="w-8 h-8 text-t-muted opacity-30" />
                      <p className="text-sm text-t-secondary">
                        {searchTerm ? "Sin resultados para esa búsqueda" : "No hay productos en esta categoría"}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-b-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-t-muted order-2 sm:order-1">
              Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total} productos
            </p>
            <div className="flex items-center gap-1 order-1 sm:order-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isPending}
                className="px-3 py-1.5 text-sm bg-card border border-b-default text-t-secondary hover:text-t-primary rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <span className="px-3 py-1.5 text-sm text-t-muted">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isPending}
                className="px-3 py-1.5 text-sm bg-card border border-b-default text-t-secondary hover:text-t-primary rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal CRUD */}
      {modalOpen && editingItem && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="bg-sidebar border border-b-default rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-[var(--shadow-lg)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-b-default">
              <h2 className="text-base font-semibold text-t-primary">
                {editingItem.id ? "Editar Producto" : "Nuevo Producto"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-t-muted hover:text-t-primary hover:bg-card-hover transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Categoría */}
              <div>
                <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">
                  Categoría
                </label>
                <select
                  value={editingItem.categoria}
                  onChange={(e) => {
                    const cat = e.target.value as CategoriaProducto;
                    setEditingItem({ ...editingItem, categoria: cat, maneja_stock: cat.includes("aro") });
                  }}
                  className="w-full px-3 py-2.5 bg-input border border-b-default rounded-lg text-t-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                >
                  {categorias.filter((c) => c.id !== "todo").map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">
                  {requiresBrand ? "Nombre (opcional)" : "Descripción *"}
                </label>
                <input
                  type="text"
                  required={!requiresBrand}
                  value={editingItem.nombre || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, nombre: e.target.value })}
                  placeholder={requiresBrand ? "Ej: Aro Deportivo" : "Ej: Examen Visual Completo"}
                  className="w-full px-3 py-2.5 bg-input border border-b-default rounded-lg text-t-primary text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Marca / Modelo / Color — solo aros */}
              {requiresBrand && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "marca" as const, label: "Marca *", required: true },
                    { key: "modelo" as const, label: "Modelo", required: false },
                    { key: "color" as const, label: "Color", required: false },
                  ].map(({ key, label, required }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">{label}</label>
                      <input
                        type="text"
                        required={required}
                        value={(editingItem[key] as string) || ""}
                        onChange={(e) => setEditingItem({ ...editingItem, [key]: e.target.value })}
                        className="w-full px-3 py-2.5 bg-input border border-b-default rounded-lg text-t-primary text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Precios + Stock */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "precio_costo" as const, label: "Costo ($)", required: true },
                  { key: "precio" as const, label: "Precio Venta ($)", required: true },
                  { key: "stock" as const, label: "Stock", required: false },
                ].map(({ key, label, required }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">{label}</label>
                    <input
                      type="number"
                      step={key === "stock" ? "1" : "0.01"}
                      min={0}
                      required={required}
                      disabled={key === "stock" && !editingItem.maneja_stock}
                      value={editingItem[key] ?? 0}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          [key]: key === "stock"
                            ? parseInt(e.target.value) || 0
                            : parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2.5 bg-input border border-b-default rounded-lg text-t-primary text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-40 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                ))}
              </div>

              {/* Toggle stock */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setEditingItem({ ...editingItem, maneja_stock: !editingItem.maneja_stock })}
                  className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${
                    editingItem.maneja_stock ? "bg-blue-600" : "bg-input border border-b-default"
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    editingItem.maneja_stock ? "translate-x-5" : "translate-x-0"
                  }`} />
                </div>
                <span className="text-xs text-t-secondary">
                  Control de stock — descuenta unidades al vender
                </span>
              </label>

              {saveError && (
                <p className="text-xs text-t-red bg-a-red-bg border border-a-red-border rounded-lg px-3 py-2">
                  {saveError}
                </p>
              )}

              {/* Acciones */}
              <div className="flex justify-end gap-3 pt-2 border-t border-b-default">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 min-h-10 text-sm bg-card border border-b-default text-t-secondary hover:text-t-primary rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 min-h-10 text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition shadow-lg shadow-blue-600/25 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
