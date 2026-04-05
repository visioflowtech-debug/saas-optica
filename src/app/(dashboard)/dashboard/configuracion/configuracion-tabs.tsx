"use client";

import { useState, useTransition } from "react";
import { actualizarEmpresa, actualizarSucursal, toggleCampanasActivas, actualizarConfigOperacional, actualizarUsuario, toggleUsuarioActivo, asignarSucursalUsuario, quitarSucursalUsuario } from "./actions";
import {
  crearLaboratorio, actualizarLaboratorio, toggleLaboratorioActivo, eliminarLaboratorio,
} from "./laboratorio-actions";
import {
  crearCategoriaGasto, toggleCategoriaGasto, eliminarCategoriaGasto,
} from "./categorias-actions";
import type { CategoriaItem } from "./categorias-actions";
import {
  crearOptometrista, toggleOptometrista, eliminarOptometrista,
} from "./optometristas-actions";
import type { OptometristaItem } from "./optometristas-actions";
import { sincronizarProductosZoho } from "../inventario/zoho-sync-action";
import { probarConexionZoho } from "./zoho-diagnostico-action";
import { createClient } from "@/lib/supabase/client";

interface Empresa  { id: string; nombre: string; nit: string | null; logo_url: string | null; email: string | null; }
interface Sucursal { id: string; nombre: string; direccion: string | null; telefono: string | null; campanas_activas: boolean; items_por_pagina: number; dias_kanban_entregado: number; }
interface Laboratorio { id: string; nombre: string; contacto: string | null; telefono: string | null; email: string | null; activo: boolean; }
interface UsuarioItem { id: string; nombre: string; rol: string; sucursal_id: string; activo: boolean; sucursal: { nombre: string } | { nombre: string }[] | null; sucursales_asignadas: { id: string; nombre: string }[]; }

interface Props {
  empresa: Empresa;
  sucursales: Sucursal[];
  laboratorios: Laboratorio[];
  categoriasGasto: CategoriaItem[];
  usuarios: UsuarioItem[];
  optometristas: OptometristaItem[];
}

type TabMode = "empresa" | "sucursales" | "laboratorios" | "categorias" | "usuarios" | "optometristas" | "integraciones";

export default function ConfiguracionTabs({ empresa, sucursales, laboratorios, categoriasGasto, usuarios, optometristas }: Props) {
  const [activeTab, setActiveTab] = useState<TabMode>("empresa");

  const tabs: { key: TabMode; label: string }[] = [
    { key: "empresa",        label: "Empresa" },
    { key: "sucursales",     label: `Sucursales (${sucursales.length})` },
    { key: "laboratorios",   label: `Laboratorios (${laboratorios.length})` },
    { key: "categorias",     label: "Categorías" },
    { key: "optometristas",  label: `Optometristas (${optometristas.length})` },
    { key: "usuarios",       label: `Usuarios (${usuarios.length})` },
    { key: "integraciones",  label: "Integraciones" },
  ];

  return (
    <>
      <div className="flex gap-0 border-b border-b-default">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === t.key
                ? "border-t-blue text-t-blue"
                : "border-transparent text-t-muted hover:text-t-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {activeTab === "empresa"      && <EmpresaForm empresa={empresa} />}
        {activeTab === "sucursales"   && <SucursalesList sucursales={sucursales} />}
        {activeTab === "laboratorios" && <LaboratoriosTab laboratorios={laboratorios} />}
        {activeTab === "categorias"    && <CategoriasTab categoriasGasto={categoriasGasto} />}
        {activeTab === "optometristas" && <OptometristasTab optometristas={optometristas} />}
        {activeTab === "usuarios"      && <UsuariosTab usuarios={usuarios} sucursales={sucursales} />}
        {activeTab === "integraciones" && <IntegracionesTab />}
      </div>
    </>
  );
}

/* ─── EmpresaForm ──────────────────────────────────────── */
function EmpresaForm({ empresa }: { empresa: Empresa }) {
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState("");
  const [logoUrl, setLogoUrl] = useState(empresa.logo_url || "");
  const [isUploading, setIsUploading] = useState(false);
  const supabase = createClient();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      setSuccessMsg("");
      const result = await actualizarEmpresa(empresa.id, {
        nombre: fd.get("nombre") as string,
        nit: fd.get("nit") as string,
        email: fd.get("email") as string,
        logo_url: logoUrl,
      });
      if (result.success) setSuccessMsg("Datos de empresa guardados correctamente.");
      else alert(result.error);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const filePath = `${empresa.id}/logo_${Date.now()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("logos").upload(filePath, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(filePath);
      setLogoUrl(publicUrl);
    } catch (err: unknown) {
      alert("Error subiendo el logo: " + (err instanceof Error ? err.message : "Desconocido"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)] p-6">
      <h2 className="text-sm font-semibold text-t-primary uppercase tracking-wider mb-6">Información General</h2>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {successMsg && <div className="p-3 bg-a-green-bg border border-a-green-border text-t-green rounded-lg text-sm">✓ {successMsg}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-t-secondary">Nombre de la Empresa</label>
            <input required name="nombre" type="text" defaultValue={empresa.nombre}
              className="w-full px-3 py-2 bg-input border border-b-strong rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]" placeholder="Ej: Óptica Visión Brillante" />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-t-secondary">NIT / Registro Fiscal</label>
            <input name="nit" type="text" defaultValue={empresa.nit || ""}
              className="w-full px-3 py-2 bg-input border border-b-strong rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]" placeholder="0000-000000-000-0" />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-t-secondary">Correo Electrónico</label>
            <input name="email" type="email" defaultValue={empresa.email || ""}
              className="w-full px-3 py-2 bg-input border border-b-strong rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]" placeholder="contacto@optica.com" />
            <p className="text-[10px] text-t-muted">Saldrá impreso en tus PDFs.</p>
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-t-secondary">Logo de la Empresa</label>
          <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={isUploading || isPending}
            className="w-full px-3 py-2 bg-input border border-b-strong rounded-lg text-t-primary text-sm focus:outline-none file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[var(--accent-blue)] file:text-white hover:file:bg-blue-600 transition" />
          {isUploading && <p className="text-xs text-t-blue">Subiendo imagen...</p>}
          <p className="text-[10px] text-t-muted">Se imprime en Tickets, Recetas y Sobres de laboratorio.</p>
        </div>
        {logoUrl && (
          <div className="p-4 bg-empty border border-dashed border-b-strong rounded-xl inline-block relative">
            <span className="text-xs text-t-muted block mb-2 uppercase tracking-wide">Vista previa:</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Logo empresa" className="max-h-24 object-contain rounded" />
            <button type="button" onClick={() => setLogoUrl("")}
              className="absolute top-2 right-2 text-xs bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600">×</button>
          </div>
        )}
        <div className="pt-4 border-t border-b-subtle flex justify-end">
          <button type="submit" disabled={isPending}
            className="px-6 py-2 bg-[var(--accent-blue)] hover:bg-blue-600 text-white font-semibold rounded-lg transition disabled:opacity-50">
            {isPending ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── SucursalesList ───────────────────────────────────── */
function SucursalesList({ sucursales }: { sucursales: Sucursal[] }) {
  return (
    <div className="space-y-4">
      {sucursales.map((suc, idx) => <SucursalCard key={suc.id} sucursal={suc} index={idx + 1} />)}
    </div>
  );
}

const OPCIONES_PAGINACION = [5, 10, 15, 20, 25, 30, 50, 100];

function SucursalCard({ sucursal, index }: { sucursal: Sucursal; index: number }) {
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState("");
  const [campanas, setCampanas] = useState(sucursal.campanas_activas);
  const [itemsPagina, setItemsPagina] = useState(sucursal.items_por_pagina ?? 25);
  const [diasKanban, setDiasKanban] = useState(sucursal.dias_kanban_entregado ?? 7);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      setSuccessMsg("");
      const r = await actualizarSucursal(sucursal.id, { nombre: fd.get("nombre") as string, direccion: fd.get("direccion") as string, telefono: fd.get("telefono") as string });
      if (r.success) { setSuccessMsg("✓"); setTimeout(() => setSuccessMsg(""), 3000); } else alert(r.error);
    });
  };

  const handleToggleCampanas = () => {
    const nuevo = !campanas; setCampanas(nuevo);
    startTransition(async () => {
      const r = await toggleCampanasActivas(sucursal.id, nuevo);
      if (!r.success) { setCampanas(!nuevo); alert(r.error); }
    });
  };

  const handleGuardarOperacional = () => {
    startTransition(async () => {
      const r = await actualizarConfigOperacional(sucursal.id, { items_por_pagina: itemsPagina, dias_kanban_entregado: diasKanban });
      if (r.success) { setSuccessMsg("✓"); setTimeout(() => setSuccessMsg(""), 3000); } else alert(r.error);
    });
  };

  return (
    <div className="bg-card border border-b-default rounded-xl shadow-[var(--shadow-card)] p-5 space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded bg-[var(--accent-blue)] text-white flex items-center justify-center text-xs font-bold">{index}</span>
        <h3 className="text-base font-bold text-t-primary uppercase tracking-wide">Configuración Sucursal</h3>
        {successMsg && <span className="ml-auto text-xs font-semibold text-t-green">✓ Guardado</span>}
      </div>

      {/* Datos básicos */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-semibold text-t-muted">Nombre</label>
            <input required name="nombre" defaultValue={sucursal.nombre}
              className="w-full px-3 py-1.5 text-sm bg-input border border-b-strong rounded focus:ring-2 focus:ring-[var(--accent-blue)] text-t-primary" />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-semibold text-t-muted">Teléfono</label>
            <input name="telefono" defaultValue={sucursal.telefono || ""} placeholder="Ej. +503 2222-2222"
              className="w-full px-3 py-1.5 text-sm bg-input border border-b-strong rounded focus:ring-2 focus:ring-[var(--accent-blue)] text-t-primary" />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-semibold text-t-muted">Dirección</label>
            <textarea name="direccion" defaultValue={sucursal.direccion || ""} rows={2}
              className="w-full px-3 py-1.5 text-sm bg-input border border-b-strong rounded focus:ring-2 focus:ring-[var(--accent-blue)] text-t-primary resize-none" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleToggleCampanas} disabled={isPending}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${campanas ? "bg-[var(--accent-blue)]" : "bg-gray-600"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${campanas ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <div>
              <p className="text-xs font-semibold text-t-primary">Módulo de Campañas</p>
              <p className="text-[10px] text-t-muted">{campanas ? "Activo" : "Inactivo"}</p>
            </div>
          </div>
          <button type="submit" disabled={isPending}
            className="px-4 py-1.5 text-xs bg-input border border-b-strong text-t-primary hover:border-[var(--accent-blue)] font-semibold rounded transition disabled:opacity-50">
            {isPending ? "Guardando..." : "Actualizar"}
          </button>
        </div>
      </form>

      {/* Config operacional */}
      <div className="pt-4 border-t border-b-subtle">
        <p className="text-[10px] uppercase font-semibold text-t-muted mb-3 tracking-wider">Parámetros Operacionales</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Paginación */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-t-secondary">
              Registros por página
            </label>
            <div className="flex flex-wrap gap-2">
              {OPCIONES_PAGINACION.map((n) => (
                <button key={n} type="button" onClick={() => setItemsPagina(n)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition ${
                    itemsPagina === n
                      ? "bg-[var(--accent-blue)] text-white border-[var(--accent-blue)]"
                      : "bg-input border-b-strong text-t-secondary hover:border-[var(--accent-blue)] hover:text-t-primary"
                  }`}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-t-muted">Aplica a listas de pacientes y exámenes.</p>
          </div>

          {/* Kanban entregado */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-t-secondary">
              Días visibles en kanban — &quot;Entregado&quot;
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1} max={365}
                value={diasKanban}
                onChange={(e) => setDiasKanban(Math.min(365, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-20 px-3 py-1.5 text-sm bg-input border border-b-strong rounded focus:ring-2 focus:ring-[var(--accent-blue)] text-t-primary text-center"
              />
              <span className="text-xs text-t-muted">días</span>
            </div>
            <p className="text-[10px] text-t-muted">Órdenes entregadas se ocultan del kanban después de este tiempo.</p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={handleGuardarOperacional} disabled={isPending}
            className="px-4 py-1.5 text-xs bg-[var(--accent-blue)] hover:bg-blue-600 text-white font-semibold rounded-lg transition disabled:opacity-50">
            {isPending ? "Guardando..." : "Guardar parámetros"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── LaboratoriosTab ──────────────────────────────────── */
function LaboratoriosTab({ laboratorios: initial }: { laboratorios: Laboratorio[] }) {
  const [labs, setLabs] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nombre: "", contacto: "", telefono: "", email: "" });
  const [newForm, setNewForm] = useState({ nombre: "", contacto: "", telefono: "", email: "" });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleCreate = () => {
    if (!newForm.nombre.trim()) { setError("El nombre es requerido"); return; }
    setError("");
    const fd = new FormData();
    Object.entries(newForm).forEach(([k, v]) => fd.set(k, v));
    startTransition(async () => {
      const r = await crearLaboratorio(fd);
      if (r.error) { setError(r.error); return; }
      setShowForm(false);
      setNewForm({ nombre: "", contacto: "", telefono: "", email: "" });
      // Optimistic: add placeholder, page will revalidate
      setLabs((prev) => [...prev, { id: crypto.randomUUID(), ...newForm, activo: true }]);
    });
  };

  const handleUpdate = (id: string) => {
    startTransition(async () => {
      const r = await actualizarLaboratorio(id, editForm);
      if (r.error) { setError(r.error); return; }
      setLabs((prev) => prev.map((l) => l.id === id ? { ...l, ...editForm } : l));
      setEditingId(null);
    });
  };

  const handleToggle = (id: string, activo: boolean) => {
    startTransition(async () => {
      await toggleLaboratorioActivo(id, !activo);
      setLabs((prev) => prev.map((l) => l.id === id ? { ...l, activo: !activo } : l));
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("¿Eliminar este laboratorio? Se desvinculará de las órdenes existentes.")) return;
    startTransition(async () => {
      const r = await eliminarLaboratorio(id);
      if (r.error) { alert(r.error); return; }
      setLabs((prev) => prev.filter((l) => l.id !== id));
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-t-primary">Proveedores de Laboratorio</h2>
          <p className="text-xs text-t-muted mt-0.5">Laboratorios a los que envías órdenes de trabajo óptico</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition">
          + Agregar Laboratorio
        </button>
      </div>

      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">{error}</p>}

      {/* Form nuevo */}
      {showForm && (
        <div className="p-5 bg-a-blue-bg border border-[var(--accent-blue)] rounded-xl space-y-3">
          <p className="text-sm font-semibold text-t-primary">Nuevo Laboratorio</p>
          <div className="grid grid-cols-2 gap-3">
            {[["nombre", "Nombre *"], ["contacto", "Persona de contacto"], ["telefono", "Teléfono"], ["email", "Email"]].map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] text-t-muted uppercase block mb-0.5">{label}</label>
                <input type={key === "email" ? "email" : "text"} value={newForm[key as keyof typeof newForm]}
                  onChange={(e) => setNewForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-1.5 text-sm bg-card border border-b-default rounded-lg text-t-primary focus:outline-none focus:border-blue-500" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={isPending}
              className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50">
              {isPending ? "Guardando..." : "Guardar"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-xs text-t-muted border border-b-default rounded-lg hover:text-t-primary transition">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="bg-card border border-b-default rounded-xl overflow-hidden">
        {labs.length === 0 ? (
          <div className="py-10 text-center text-t-muted text-sm">
            No hay laboratorios registrados. Agrega los primeros proveedores.
            <div className="mt-2 text-xs text-t-muted/60">Ej: Lomed, Servilens, Vicar Vision</div>
          </div>
        ) : (
          <div className="divide-y divide-b-subtle">
            {labs.map((lab) => (
              <div key={lab.id}>
                {editingId === lab.id ? (
                  <div className="px-5 py-4 bg-a-blue-bg/30 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[["nombre", "Nombre *"], ["contacto", "Contacto"], ["telefono", "Teléfono"], ["email", "Email"]].map(([key, label]) => (
                        <div key={key}>
                          <label className="text-[10px] text-t-muted uppercase block mb-0.5">{label}</label>
                          <input type={key === "email" ? "email" : "text"} value={editForm[key as keyof typeof editForm]}
                            onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                            className="w-full px-3 py-1.5 text-sm bg-card border border-b-default rounded-lg text-t-primary focus:outline-none focus:border-blue-500" />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdate(lab.id)} disabled={isPending}
                        className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50">
                        {isPending ? "..." : "Guardar"}
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="px-4 py-1.5 text-xs text-t-muted border border-b-default rounded-lg hover:text-t-primary transition">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${lab.activo ? "text-t-primary" : "text-t-muted line-through"}`}>{lab.nombre}</p>
                      <p className="text-[10px] text-t-muted">
                        {[lab.contacto, lab.telefono, lab.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${lab.activo ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-t-muted"}`}>
                      {lab.activo ? "Activo" : "Inactivo"}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingId(lab.id); setEditForm({ nombre: lab.nombre, contacto: lab.contacto || "", telefono: lab.telefono || "", email: lab.email || "" }); }}
                        className="px-2 py-1 text-[10px] border border-b-default rounded text-t-muted hover:text-t-primary hover:border-blue-500/50 transition">
                        Editar
                      </button>
                      <button onClick={() => handleToggle(lab.id, lab.activo)} disabled={isPending}
                        className="px-2 py-1 text-[10px] border border-b-default rounded text-t-muted hover:text-t-primary transition">
                        {lab.activo ? "Desactivar" : "Activar"}
                      </button>
                      <button onClick={() => handleDelete(lab.id)} disabled={isPending}
                        className="px-2 py-1 text-[10px] border border-red-500/30 rounded text-t-red hover:bg-red-500/10 transition">
                        🗑
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── CategoriasTab ────────────────────────────────────── */
function CategoriasTab({ categoriasGasto: initial }: { categoriasGasto: CategoriaItem[] }) {
  const [cats, setCats] = useState(initial);
  const [newLabel, setNewLabel] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleCreate = () => {
    if (!newLabel.trim()) { setError("Escribe un nombre de categoría"); return; }
    setError("");
    startTransition(async () => {
      const r = await crearCategoriaGasto(newLabel);
      if (r.error) { setError(r.error); return; }
      const valor = newLabel.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      setCats((prev) => [...prev, { id: crypto.randomUUID(), valor, label: newLabel.trim(), activo: true, esPredeterminada: false }]);
      setNewLabel("");
    });
  };

  const handleToggle = (id: string, activo: boolean) => {
    startTransition(async () => {
      await toggleCategoriaGasto(id, !activo);
      setCats((prev) => prev.map((c) => c.id === id ? { ...c, activo: !activo } : c));
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("¿Eliminar esta categoría?")) return;
    startTransition(async () => {
      const r = await eliminarCategoriaGasto(id);
      if (r.error) { alert(r.error); return; }
      setCats((prev) => prev.filter((c) => c.id !== id));
    });
  };

  const predeterminadas = cats.filter((c) => c.esPredeterminada);
  const personalizadas  = cats.filter((c) => !c.esPredeterminada);

  return (
    <div className="space-y-6">
      {/* Categorías de Gastos */}
      <div className="bg-card border border-b-default rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-b-subtle">
          <h2 className="text-sm font-semibold text-t-primary">Categorías de Gastos</h2>
          <p className="text-xs text-t-muted mt-0.5">Las predeterminadas son del sistema; puedes agregar categorías personalizadas.</p>
        </div>

        {/* Predeterminadas (solo lectura) */}
        <div className="px-5 py-3">
          <p className="text-[10px] text-t-muted uppercase tracking-wider mb-2 font-semibold">Sistema (no editables)</p>
          <div className="flex flex-wrap gap-2">
            {predeterminadas.map((c) => (
              <span key={c.valor} className="px-3 py-1 text-xs font-medium bg-gray-500/10 text-t-secondary border border-b-default rounded-full">
                {c.label}
              </span>
            ))}
          </div>
        </div>

        {/* Personalizadas */}
        {personalizadas.length > 0 && (
          <div className="px-5 py-3 border-t border-b-subtle">
            <p className="text-[10px] text-t-muted uppercase tracking-wider mb-2 font-semibold">Personalizadas</p>
            <div className="space-y-2">
              {personalizadas.map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <span className={`text-sm ${c.activo ? "text-t-primary" : "text-t-muted line-through"}`}>{c.label}</span>
                  <div className="flex gap-1">
                    {c.id && (
                      <>
                        <button onClick={() => handleToggle(c.id!, c.activo)} disabled={isPending}
                          className="px-2 py-0.5 text-[10px] border border-b-default rounded text-t-muted hover:text-t-primary transition">
                          {c.activo ? "Desactivar" : "Activar"}
                        </button>
                        <button onClick={() => handleDelete(c.id!)} disabled={isPending}
                          className="px-2 py-0.5 text-[10px] border border-red-500/30 rounded text-t-red hover:bg-red-500/10 transition">
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agregar nueva */}
        <div className="px-5 py-4 border-t border-b-subtle bg-empty/40">
          <p className="text-[10px] text-t-muted uppercase tracking-wider mb-2 font-semibold">Agregar categoría</p>
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <div className="flex gap-2">
            <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Ej: Viáticos, Material POP..."
              className="flex-1 px-3 py-1.5 text-sm bg-card border border-b-default rounded-lg text-t-primary focus:outline-none focus:border-blue-500" />
            <button onClick={handleCreate} disabled={isPending}
              className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50">
              {isPending ? "..." : "+ Agregar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── OptometristasTab ─────────────────────────────────── */
function OptometristasTab({ optometristas: initial }: { optometristas: OptometristaItem[] }) {
  const [opts, setOpts] = useState(initial);
  const [newNombre, setNewNombre] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleCreate = () => {
    if (!newNombre.trim()) { setError("Escribe un nombre"); return; }
    setError("");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("nombre", newNombre.trim());
      const r = await crearOptometrista(fd);
      if (r.error) { setError(r.error); return; }
      setOpts((prev) => [...prev, { id: crypto.randomUUID(), nombre: newNombre.trim(), activo: true }]);
      setNewNombre("");
    });
  };

  const handleToggle = (id: string, activo: boolean) => {
    startTransition(async () => {
      await toggleOptometrista(id, !activo);
      setOpts((prev) => prev.map((o) => o.id === id ? { ...o, activo: !activo } : o));
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("¿Eliminar este optometrista?")) return;
    startTransition(async () => {
      const r = await eliminarOptometrista(id);
      if (r.error) { alert(r.error); return; }
      setOpts((prev) => prev.filter((o) => o.id !== id));
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-b-default rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-b-subtle">
          <h2 className="text-sm font-semibold text-t-primary">Optometristas</h2>
          <p className="text-xs text-t-muted mt-0.5">Lista de profesionales disponibles para asignar en el formulario de examen.</p>
        </div>

        {opts.length > 0 && (
          <div className="px-5 py-3">
            <div className="space-y-2">
              {opts.map((o) => (
                <div key={o.id} className="flex items-center justify-between">
                  <span className={`text-sm ${o.activo ? "text-t-primary" : "text-t-muted line-through"}`}>{o.nombre}</span>
                  <div className="flex gap-1">
                    <button onClick={() => handleToggle(o.id, o.activo)} disabled={isPending}
                      className="px-2 py-0.5 text-[10px] border border-b-default rounded text-t-muted hover:text-t-primary transition">
                      {o.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button onClick={() => handleDelete(o.id)} disabled={isPending}
                      className="px-2 py-0.5 text-[10px] border border-red-500/30 rounded text-t-red hover:bg-red-500/10 transition">
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {opts.length === 0 && (
          <div className="px-5 py-6 text-center text-sm text-t-muted">
            No hay optometristas configurados. Agrega el primero.
          </div>
        )}

        <div className="px-5 py-4 border-t border-b-subtle bg-empty/40">
          <p className="text-[10px] text-t-muted uppercase tracking-wider mb-2 font-semibold">Agregar optometrista</p>
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <div className="flex gap-2">
            <input type="text" value={newNombre} onChange={(e) => setNewNombre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Ej: Dra. María López"
              className="flex-1 px-3 py-1.5 text-sm bg-card border border-b-default rounded-lg text-t-primary focus:outline-none focus:border-blue-500" />
            <button onClick={handleCreate} disabled={isPending}
              className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50">
              {isPending ? "..." : "+ Agregar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── UsuariosTab ──────────────────────────────────────── */
const ROLES_LABELS: Record<string, string> = {
  administrador: "Administrador",
  optometrista:  "Optometrista",
  asesor_visual: "Asesor Visual",
  laboratorio:   "Laboratorio",
  contador:      "Contador",
};

function rolBadgeClass(rol: string) {
  if (rol === "administrador") return "bg-blue-500/15 text-blue-400";
  if (rol === "optometrista")  return "bg-purple-500/15 text-purple-400";
  if (rol === "asesor_visual") return "bg-green-500/15 text-green-400";
  if (rol === "laboratorio")   return "bg-orange-500/15 text-orange-400";
  if (rol === "contador")      return "bg-yellow-500/15 text-yellow-400";
  return "bg-gray-500/15 text-t-muted";
}

/* ─── IntegracionesTab ─────────────────────────────────── */
function IntegracionesTab() {
  const [isPending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<{ ok: number; errores: number; mensajesError: string[] } | null>(null);
  const [error, setError] = useState("");
  const [testPending, setTestPending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; mensaje: string; detalle?: string } | null>(null);

  const handleTestConexion = () => {
    setTestResult(null);
    setTestPending(true);
    startTransition(async () => {
      try {
        const r = await probarConexionZoho();
        setTestResult(r);
      } catch (e: unknown) {
        setTestResult({ ok: false, mensaje: "Error al llamar la acción", detalle: e instanceof Error ? e.message : String(e) });
      } finally {
        setTestPending(false);
      }
    });
  };

  const handleSyncProductos = () => {
    setResultado(null);
    setError("");
    startTransition(async () => {
      try {
        const r = await sincronizarProductosZoho();
        setResultado(r);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error desconocido");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-b-default rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-b-subtle">
          <h2 className="text-sm font-semibold text-t-primary">Zoho Books</h2>
          <p className="text-xs text-t-muted mt-0.5">
            Sincronización con Zoho Books. Los nuevos registros se sincronizan automáticamente.
          </p>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Estado de conexión + botón diagnóstico */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full inline-block ${testResult ? (testResult.ok ? "bg-emerald-500" : "bg-red-500") : "bg-emerald-500"}`} />
              <span className="text-xs text-t-secondary">Zoho Books · región Americas (.com)</span>
            </div>
            <button
              onClick={handleTestConexion}
              disabled={testPending || isPending}
              className="px-3 py-1 text-xs font-medium border border-b-default rounded-lg hover:bg-white/5 transition disabled:opacity-50"
            >
              {testPending ? "Probando..." : "Probar conexión"}
            </button>
          </div>
          {testResult && (
            <div className={`rounded-lg px-3 py-2 text-xs ${testResult.ok ? "bg-emerald-950/40 text-emerald-400" : "bg-red-950/40 text-red-400"}`}>
              <p className="font-medium">{testResult.ok ? "✓" : "✗"} {testResult.mensaje}</p>
              {testResult.detalle && <p className="mt-1 opacity-75 break-all">{testResult.detalle}</p>}
            </div>
          )}

          {/* Sync masivo productos */}
          <div className="border border-b-default rounded-lg p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-t-primary">Sincronizar productos al catálogo</p>
              <p className="text-xs text-t-muted mt-0.5">
                Crea en Zoho Books los productos que aún no tienen ID de Zoho. Los productos futuros se sincronizan automáticamente.
              </p>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            {resultado && (
              <div className="space-y-1">
                <p className="text-xs text-emerald-400">
                  ✓ {resultado.ok} sincronizados{resultado.errores > 0 && ` · ${resultado.errores} con error`}
                </p>
                {resultado.mensajesError.map((msg, i) => (
                  <p key={i} className="text-xs text-red-400 break-all">✗ {msg}</p>
                ))}
              </div>
            )}

            <button
              onClick={handleSyncProductos}
              disabled={isPending}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50"
            >
              {isPending ? "Sincronizando..." : "Sincronizar productos pendientes"}
            </button>
          </div>

          {/* Info scopes */}
          <div className="border border-b-default rounded-lg p-4">
            <p className="text-sm font-medium text-t-primary mb-2">Datos sincronizados</p>
            <ul className="text-xs text-t-muted space-y-1">
              <li>→ <span className="text-t-secondary">Pacientes</span> → Contactos (clientes)</li>
              <li>→ <span className="text-t-secondary">Ventas</span> → Facturas</li>
              <li>→ <span className="text-t-secondary">Abonos</span> → Pagos de cliente</li>
              <li>→ <span className="text-t-secondary">Gastos</span> → Gastos</li>
              <li>→ <span className="text-t-secondary">Productos</span> → Catálogo de ítems</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsuariosTab({ usuarios: initial, sucursales }: { usuarios: UsuarioItem[]; sucursales: Sucursal[] }) {
  const [usuarios, setUsuarios] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ rol: "", sucursal_id: "" });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [successId, setSuccessId] = useState<string | null>(null);

  const startEdit = (u: UsuarioItem) => {
    setEditingId(u.id);
    setEditForm({ rol: u.rol, sucursal_id: u.sucursal_id });
    setError("");
  };

  const handleSave = (userId: string) => {
    setError("");
    startTransition(async () => {
      const r = await actualizarUsuario(userId, editForm);
      if (!r.success) { setError(r.error ?? "Error"); return; }
      // Asegurar que la sucursal principal está en usuario_sucursales
      await asignarSucursalUsuario(userId, editForm.sucursal_id);
      setUsuarios((prev) => prev.map((u) => u.id === userId
        ? {
            ...u,
            rol: editForm.rol,
            sucursal_id: editForm.sucursal_id,
            // Agregar la nueva sucursal principal si no estaba ya
            sucursales_asignadas: u.sucursales_asignadas.some((s) => s.id === editForm.sucursal_id)
              ? u.sucursales_asignadas
              : [...u.sucursales_asignadas, { id: editForm.sucursal_id, nombre: sucursales.find((s) => s.id === editForm.sucursal_id)?.nombre ?? "" }],
          }
        : u
      ));
      setEditingId(null);
      setSuccessId(userId);
      setTimeout(() => setSuccessId(null), 3000);
    });
  };

  const handleToggleActivo = (userId: string, activoActual: boolean) => {
    const accion = activoActual ? "suspender" : "activar";
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} este usuario?`)) return;
    startTransition(async () => {
      const r = await toggleUsuarioActivo(userId, !activoActual);
      if (!r.success) { setError(r.error ?? "Error"); return; }
      setUsuarios((prev) => prev.map((u) => u.id === userId ? { ...u, activo: !activoActual } : u));
    });
  };

  const handleAgregarSucursal = (userId: string, sucursalId: string) => {
    if (!sucursalId) return;
    startTransition(async () => {
      const r = await asignarSucursalUsuario(userId, sucursalId);
      if (!r.success) { setError(r.error ?? "Error"); return; }
      const suc = sucursales.find((s) => s.id === sucursalId);
      if (!suc) return;
      setUsuarios((prev) => prev.map((u) => u.id === userId
        ? { ...u, sucursales_asignadas: u.sucursales_asignadas.some((s) => s.id === sucursalId) ? u.sucursales_asignadas : [...u.sucursales_asignadas, { id: suc.id, nombre: suc.nombre }] }
        : u
      ));
    });
  };

  const handleQuitarSucursal = (userId: string, sucursalId: string, sucursalNombreVal: string) => {
    if (!confirm(`¿Quitar acceso a "${sucursalNombreVal}" de este usuario?`)) return;
    startTransition(async () => {
      const r = await quitarSucursalUsuario(userId, sucursalId);
      if (!r.success) { setError(r.error ?? "Error"); return; }
      setUsuarios((prev) => prev.map((u) => u.id === userId
        ? { ...u, sucursales_asignadas: u.sucursales_asignadas.filter((s) => s.id !== sucursalId) }
        : u
      ));
    });
  };

  const getSucursalNombre = (u: UsuarioItem) => {
    const suc = Array.isArray(u.sucursal) ? u.sucursal[0] : u.sucursal;
    return (suc as any)?.nombre ?? sucursales.find((s) => s.id === u.sucursal_id)?.nombre ?? "—";
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-t-primary">Gestión de Usuarios</h2>
        <p className="text-xs text-t-muted mt-0.5">Asigna roles, sucursales y controla el acceso de cada usuario.</p>
      </div>

      {error && (
        <p className="text-xs text-t-red bg-a-red-bg border border-a-red-border px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      <div className="bg-card border border-b-default rounded-xl overflow-hidden">
        {usuarios.length === 0 ? (
          <div className="py-10 text-center text-t-muted text-sm">
            No hay usuarios registrados en esta organización.
          </div>
        ) : (
          <div className="divide-y divide-b-subtle">
            {usuarios.map((u) => (
              <div key={u.id}>
                {editingId === u.id ? (
                  /* ── Modo edición ── */
                  <div className="px-5 py-4 bg-a-blue-bg/30 space-y-4">
                    <p className="text-sm font-semibold text-t-primary">{u.nombre}</p>

                    {/* Rol + Sucursal principal */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-t-muted uppercase tracking-wider block mb-1.5">Rol</label>
                        <select
                          value={editForm.rol}
                          onChange={(e) => setEditForm((f) => ({ ...f, rol: e.target.value }))}
                          className="w-full px-3 py-2 text-sm bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {Object.entries(ROLES_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-t-muted uppercase tracking-wider block mb-1.5">Sucursal Principal</label>
                        <select
                          value={editForm.sucursal_id}
                          onChange={(e) => setEditForm((f) => ({ ...f, sucursal_id: e.target.value }))}
                          className="w-full px-3 py-2 text-sm bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {sucursales.map((s) => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Sucursales adicionales */}
                    <div>
                      <label className="text-[10px] text-t-muted uppercase tracking-wider block mb-1.5">Acceso a Sucursales</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {u.sucursales_asignadas.map((s) => (
                          <span key={s.id} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-a-blue-bg text-t-blue border border-a-blue-border rounded-full">
                            {s.nombre}
                            {s.id !== u.sucursal_id && (
                              <button
                                type="button"
                                onClick={() => handleQuitarSucursal(u.id, s.id, s.nombre)}
                                disabled={isPending}
                                className="ml-0.5 text-t-muted hover:text-t-red transition"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                      {/* Agregar sucursal */}
                      {sucursales.filter((s) => !u.sucursales_asignadas.some((a) => a.id === s.id)).length > 0 && (
                        <select
                          defaultValue=""
                          onChange={(e) => { if (e.target.value) { handleAgregarSucursal(u.id, e.target.value); e.target.value = ""; } }}
                          disabled={isPending}
                          className="px-3 py-1.5 text-xs bg-input border border-b-default rounded-lg text-t-secondary focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">+ Agregar sucursal...</option>
                          {sucursales
                            .filter((s) => !u.sucursales_asignadas.some((a) => a.id === s.id))
                            .map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)
                          }
                        </select>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(u.id)}
                        disabled={isPending}
                        className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50"
                      >
                        {isPending ? "Guardando..." : "Guardar"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-1.5 text-xs text-t-muted border border-b-default rounded-lg hover:text-t-primary transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Vista normal ── */
                  <div className={`flex items-start gap-4 px-5 py-3.5 transition ${!u.activo ? "opacity-50" : "hover:bg-card-hover"}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 ${
                      u.activo ? "bg-gradient-to-br from-blue-500 to-purple-600" : "bg-gray-500"
                    }`}>
                      {u.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-semibold ${u.activo ? "text-t-primary" : "text-t-muted line-through"}`}>
                          {u.nombre}
                        </p>
                        {!u.activo && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-a-red-bg text-t-red border border-a-red-border font-semibold">
                            Suspendido
                          </span>
                        )}
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${rolBadgeClass(u.rol)}`}>
                          {ROLES_LABELS[u.rol] ?? u.rol}
                        </span>
                      </div>
                      {/* Sucursales asignadas */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {u.sucursales_asignadas.length > 0 ? (
                          u.sucursales_asignadas.map((s) => (
                            <span key={s.id} className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              s.id === u.sucursal_id
                                ? "bg-a-blue-bg text-t-blue border-a-blue-border font-medium"
                                : "bg-card text-t-muted border-b-default"
                            }`}>
                              {s.id === u.sucursal_id ? "★ " : ""}{s.nombre}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-t-muted">{getSucursalNombre(u)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {successId === u.id && <span className="text-xs text-t-green font-semibold">✓ Guardado</span>}
                      <button
                        onClick={() => startEdit(u)}
                        disabled={isPending}
                        className="px-2.5 py-1 text-[10px] border border-b-default rounded-lg text-t-muted hover:text-t-primary hover:border-blue-500/50 transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggleActivo(u.id, u.activo)}
                        disabled={isPending}
                        className={`px-2.5 py-1 text-[10px] border rounded-lg transition ${
                          u.activo
                            ? "border-a-red-border text-t-red hover:bg-a-red-bg"
                            : "border-a-green-border text-t-green hover:bg-a-green-bg"
                        }`}
                      >
                        {u.activo ? "Suspender" : "Activar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-card border border-b-default rounded-xl">
        <p className="text-xs font-semibold text-t-secondary mb-2">Leyenda de roles</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ROLES_LABELS).map(([val, label]) => (
            <span key={val} className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${rolBadgeClass(val)}`}>
              {label}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-t-muted mt-2">
          ★ = sucursal principal (activa). Un usuario puede tener acceso a múltiples sucursales y cambiar entre ellas desde el menú lateral.
        </p>
      </div>
    </div>
  );
}
