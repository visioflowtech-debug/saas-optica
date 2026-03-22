"use client";

import { useState, useEffect, useTransition } from "react";
import { Producto, CategoriaProducto, upsertProducto, softDeleteProducto, obtenerProductos, ajustarStock } from "./actions";
import { Search, Plus, Edit2, Trash2, Box, CircleSlash, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const categorias: { id: CategoriaProducto | "todo"; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "aro_economico", label: "Aros Económicos" },
  { id: "aro_marca", label: "Aros de Marca" },
  { id: "aro_sol", label: "Aros de Sol" },
  { id: "accesorio", label: "Accesorios" },
  { id: "lente", label: "Lentes" },
  { id: "servicio", label: "Servicios" },
  { id: "tratamiento", label: "Tratamientos" },
];

const PAGE_SIZE = 10;

export default function InventarioTabs({ 
  productosIniciales, 
  totalInicial 
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

  // Quick stock adjustment state
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [newStockVal, setNewStockVal] = useState(0);

  // Fetch data when filters/pagination change
  useEffect(() => {
    const handler = setTimeout(() => {
      startTransition(async () => {
        const { productos, total } = await obtenerProductos(activa, searchTerm, page, PAGE_SIZE);
        setProductos(productos);
        setTotal(total);
      });
    }, 400); // Debounce search

    return () => clearTimeout(handler);
  }, [activa, searchTerm, page]);

  const openNewItem = () => {
    setEditingItem({
      categoria: activa === "todo" ? "aro_economico" : activa,
      precio: 0,
      precio_costo: 0,
      maneja_stock: activa.includes("aro"),
      stock: 0,
    });
    setModalOpen(true);
  };

  const fmt = (val: number) => `$${val.toFixed(2)}`;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    setSaving(true);

    const result = await upsertProducto(editingItem);
    if (result.success) {
      setModalOpen(false);
      // Refresh current view
      const { productos, total } = await obtenerProductos(activa, searchTerm, page, PAGE_SIZE);
      setProductos(productos);
      setTotal(total);
    } else {
      alert("Error: " + result.error);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Seguro que deseas eliminar este producto del inventario?")) return;
    const result = await softDeleteProducto(id);
    if (result.success) {
       const { productos, total } = await obtenerProductos(activa, searchTerm, page, PAGE_SIZE);
       setProductos(productos);
       setTotal(total);
    } else {
       alert("Error: " + result.error);
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
    } else {
      alert("Error: " + result.error);
    }
  }

  // Derived state for modal
  const requiresStock = editingItem?.categoria?.includes("aro");
  const requiresBrand = editingItem?.categoria?.includes("aro");

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="flex bg-surface border border-b-strong rounded-lg p-1 overflow-x-auto no-scrollbar gap-1">
        {categorias.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setActiva(cat.id); setPage(1); }}
            className={`whitespace-nowrap px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 
              ${activa === cat.id 
                ? "bg-[var(--accent-blue)] text-white shadow-sm" 
                : "text-t-secondary hover:text-t-primary hover:bg-hover active:scale-95"
              }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-t-muted w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por nombre, marca o modelo..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-b-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] transition-all"
          />
          {isPending && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
               <Loader2 className="w-4 h-4 animate-spin text-t-muted" />
            </div>
          )}
        </div>
        <button
          onClick={openNewItem}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[var(--accent-blue)] text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-all shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Producto</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface border border-b-strong rounded-xl overflow-hidden shadow-sm min-h-[400px] flex flex-col justify-between">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-soft border-b border-b-strong text-t-muted">
              <tr>
                <th className="px-6 py-4 font-semibold">Producto</th>
                <th className="px-6 py-4 font-semibold">Categoría</th>
                <th className="px-6 py-4 font-semibold text-right text-amber-600">Costo</th>
                <th className="px-6 py-4 font-semibold text-right text-green-600">Venta</th>
                <th className="px-6 py-4 font-semibold text-center">Stock</th>
                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-b-strong">
              {productos.map((p) => (
                <tr key={p.id} className="hover:bg-hover transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-t-primary">
                      {p.nombre ? p.nombre : `${p.marca} ${p.modelo} - ${p.color}`}
                    </div>
                    {p.nombre && (p.marca || p.modelo) && (
                      <div className="text-xs text-t-muted mt-0.5">
                        {p.marca} {p.modelo} {p.color}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium bg-surface-soft text-t-secondary uppercase tracking-wider border border-b-strong">
                      {p.categoria.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-amber-600 font-medium">
                    {fmt(p.precio_costo)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-green-600 font-bold">
                    {fmt(p.precio)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center">
                      {p.maneja_stock ? (
                        <div className="relative">
                          {adjustingId === p.id ? (
                            <form onSubmit={handleQuickStock} className="flex items-center gap-1 animate-in slide-in-from-right-2 duration-200">
                               <input 
                                 type="number" 
                                 autoFocus
                                 value={newStockVal}
                                 onChange={e => setNewStockVal(parseInt(e.target.value) || 0)}
                                 className="w-16 px-1 py-1 bg-input border border-[var(--accent-blue)] rounded text-xs text-center focus:outline-none"
                               />
                               <button type="submit" className="p-1 text-white bg-[var(--accent-blue)] rounded hover:bg-blue-600">✓</button>
                               <button type="button" onClick={() => setAdjustingId(null)} className="p-1 text-t-muted hover:text-t-primary">✕</button>
                            </form>
                          ) : (
                            <button 
                              onClick={() => { setAdjustingId(p.id); setNewStockVal(p.stock); }}
                              className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-all hover:scale-105 active:scale-95 ${
                                p.stock > 5 ? "bg-green-500/10 text-green-600 border-green-500/20" : 
                                p.stock > 0 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : 
                                "bg-red-500/10 text-red-500 border-red-500/20"
                              }`}
                              title="Click para ajustar stock rápidamente"
                            >
                              {p.stock} unid.
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-t-muted text-xs">
                          <CircleSlash className="w-3.5 h-3.5" /> N/A
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingItem(p); setModalOpen(true); }}
                        className="p-2 text-t-secondary hover:text-[var(--accent-blue)] bg-surface-soft hover:bg-blue-500/10 rounded-md transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                         onClick={() => handleDelete(p.id)}
                        className="p-2 text-t-secondary hover:text-red-500 bg-surface-soft hover:bg-red-500/10 rounded-md transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {productos.length === 0 && !isPending && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-t-muted">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Box className="w-8 h-8 opacity-20" />
                      <p>No se encontraron productos.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-b-strong bg-surface-soft flex flex-col sm:flex-row items-center justify-between gap-4">
           <div className="text-xs text-t-muted">
              Mostrando {productos.length} de {total} registros
           </div>
           <div className="flex items-center gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isPending}
                className="p-2 bg-surface border border-b-strong rounded-lg text-t-secondary hover:text-t-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-sm font-medium text-t-primary px-3">
                Página {page} de {Math.max(1, totalPages)}
              </div>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isPending}
                className="p-2 bg-surface border border-b-strong rounded-lg text-t-secondary hover:text-t-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
           </div>
        </div>
      </div>

      {/* Modal CRUD */}
      {modalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-b-strong rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-b-strong">
              <h2 className="text-lg font-bold text-t-primary">
                {editingItem.id ? "Editar Producto" : "Nuevo Producto"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-t-muted hover:text-t-primary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-5">
              <div className="space-y-4">
                {/* Categoría */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-t-secondary">Categoría</label>
                  <select 
                    value={editingItem.categoria} 
                    onChange={e => {
                        const cat = e.target.value as CategoriaProducto;
                        setEditingItem({
                            ...editingItem,
                            categoria: cat,
                            maneja_stock: cat.includes("aro")
                        });
                    }}
                    className="w-full px-3 py-2 bg-input border border-b-strong rounded-lg text-sm text-t-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                  >
                    {categorias.filter(c => c.id !== "todo").map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Nombre Genérico */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-t-secondary">
                    {requiresBrand ? "Nombre Opcional (Ej. Aro Deportivo)" : "Descripción del Ítem"}
                  </label>
                  <input
                    type="text"
                    required={!requiresBrand}
                    value={editingItem.nombre || ""}
                    onChange={e => setEditingItem({...editingItem, nombre: e.target.value})}
                    placeholder={requiresBrand ? "Opcional..." : "Ej: Examen Visual..."}
                    className="w-full px-3 py-2 bg-input border border-b-strong rounded-lg text-sm text-t-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                  />
                </div>

                {/* Marca / Modelo / Color para aros */}
                {requiresBrand && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-t-secondary">Marca</label>
                      <input
                        type="text"
                        required
                        value={editingItem.marca || ""}
                        onChange={e => setEditingItem({...editingItem, marca: e.target.value})}
                        className="w-full px-3 py-2 bg-input border border-b-strong rounded-lg text-sm text-t-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-t-secondary">Modelo</label>
                      <input
                        type="text"
                        value={editingItem.modelo || ""}
                        onChange={e => setEditingItem({...editingItem, modelo: e.target.value})}
                        className="w-full px-3 py-2 bg-input border border-b-strong rounded-lg text-sm text-t-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-t-secondary">Color</label>
                      <input
                        type="text"
                        value={editingItem.color || ""}
                        onChange={e => setEditingItem({...editingItem, color: e.target.value})}
                        className="w-full px-3 py-2 bg-input border border-b-strong rounded-lg text-sm text-t-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                      />
                    </div>
                  </div>
                )}

                {/* Precio y Stock */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-t-secondary">Costo ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min={0}
                      value={editingItem.precio_costo}
                      onChange={e => setEditingItem({...editingItem, precio_costo: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 bg-input border border-b-strong rounded-lg text-sm text-t-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-t-secondary">Venta ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min={0}
                      value={editingItem.precio}
                      onChange={e => setEditingItem({...editingItem, precio: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 bg-input border border-b-strong rounded-lg text-sm text-t-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-t-secondary">Stock</label>
                    <input
                      type="number"
                      required={requiresStock}
                      disabled={!editingItem.maneja_stock}
                      value={editingItem.stock}
                      onChange={e => setEditingItem({...editingItem, stock: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2 bg-input border border-b-strong rounded-lg text-sm text-t-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Maneja stock manual toggle */}
                <div className="flex items-center gap-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="stockToggle" 
                    checked={editingItem.maneja_stock}
                    onChange={e => setEditingItem({...editingItem, maneja_stock: e.target.checked})}
                    className="rounded border-b-strong text-[var(--accent-blue)] focus:ring-[var(--accent-blue)] bg-input cursor-pointer" 
                  />
                  <label htmlFor="stockToggle" className="text-xs text-t-secondary cursor-pointer">
                    Este producto tiene cantidades físicas limitadas que deben descontarse al vender.
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-b-strong">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 font-medium text-t-secondary hover:text-t-primary hover:bg-hover rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-[var(--accent-blue)] text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
