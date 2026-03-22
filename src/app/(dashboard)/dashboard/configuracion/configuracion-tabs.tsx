"use client";

import { useState, useTransition } from "react";
import { actualizarEmpresa, actualizarSucursal } from "./actions";

interface Empresa {
  id: string;
  nombre: string;
  nit: string | null;
  logo_url: string | null;
  email: string | null;
}

interface Sucursal {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
}

interface Props {
  empresa: Empresa;
  sucursales: Sucursal[];
}

type TabMode = "empresa" | "sucursales";

export default function ConfiguracionTabs({ empresa, sucursales }: Props) {
  const [activeTab, setActiveTab] = useState<TabMode>("empresa");

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("empresa")}
          className={`flex-1 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === "empresa" ? "border-t-blue text-t-blue" : "border-transparent text-t-muted hover:text-t-primary"
          }`}
        >
          Empresa
        </button>
        <button
          onClick={() => setActiveTab("sucursales")}
          className={`flex-1 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === "sucursales" ? "border-t-blue text-t-blue" : "border-transparent text-t-muted hover:text-t-primary"
          }`}
        >
          Sucursales ({sucursales.length})
        </button>
      </div>

      {/* Pages */}
      {activeTab === "empresa" && <EmpresaForm empresa={empresa} />}
      {activeTab === "sucursales" && <SucursalesList sucursales={sucursales} />}
    </>
  );
}

import { createClient } from "@/lib/supabase/client";

function EmpresaForm({ empresa }: { empresa: Empresa }) {
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState("");
  const [logoUrl, setLogoUrl] = useState(empresa.logo_url || "");
  const [isUploading, setIsUploading] = useState(false);
  const supabase = createClient();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nombre = formData.get("nombre") as string;
    const nit = formData.get("nit") as string;
    const email = formData.get("email") as string;
    // We get the stored state url, not from FormData since the file input doesn't carry the URL
    const logo_url = logoUrl;

    startTransition(async () => {
      setSuccessMsg("");
      const result = await actualizarEmpresa(empresa.id, { nombre, nit, logo_url, email });
      if (result.success) {
        setSuccessMsg("Datos de empresa guardados correctamente.");
      } else {
        alert(result.error);
      }
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setSuccessMsg("");
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${Date.now()}.${fileExt}`;
      const filePath = `${empresa.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      setLogoUrl(publicUrl);
    } catch (error: any) {
      alert("Error subiendo el logo: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)] p-6">
      <h2 className="text-sm font-semibold text-t-primary uppercase tracking-wider mb-6">Información General</h2>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {successMsg && (
          <div className="p-3 bg-a-green-bg border border-a-green-border text-t-green rounded-lg text-sm">
            ✓ {successMsg}
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label htmlFor="nombre" className="block text-xs font-semibold text-t-secondary">Nombre de la Empresa</label>
            <input
              required
              id="nombre"
              name="nombre"
              type="text"
              defaultValue={empresa.nombre}
              className="w-full px-3 py-2 bg-input border border-b-strong rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
              placeholder="Ej: Óptica Visión Brillante"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="nit" className="block text-xs font-semibold text-t-secondary">NIT / Registro Fiscal (Opcional)</label>
            <input
              id="nit"
              name="nit"
              type="text"
              defaultValue={empresa.nit || ""}
              className="w-full px-3 py-2 bg-input border border-b-strong rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
              placeholder="0000-000000-000-0"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="email" className="block text-xs font-semibold text-t-secondary">Correo Electrónico (Opcional)</label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={empresa.email || ""}
              className="w-full px-3 py-2 bg-input border border-b-strong rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
              placeholder="contacto@optica.com"
            />
            <p className="text-[10px] text-t-muted mt-1">Saldrá impreso bajo el nombre en tus PDFs.</p>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-t-secondary">Logo de la Empresa</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            disabled={isUploading || isPending}
            className="w-full px-3 py-2 bg-input border border-b-strong rounded-lg text-t-primary text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[var(--accent-blue)] file:text-white hover:file:bg-blue-600 transition"
          />
          {isUploading && <p className="text-xs text-t-blue mt-1">Subiendo imagen, por favor espera...</p>}
          <p className="text-[10px] text-t-muted mt-1">Este logo se imprimirá en los encabezados del Ticket térmico, Recetas médica y Sobres de laboratorio.</p>
        </div>

        {logoUrl && (
          <div className="p-4 bg-empty border border-dashed border-b-strong rounded-xl inline-block relative">
            <span className="text-xs text-t-muted block mb-2 uppercase tracking-wide">Vista Previa Visual:</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Logo empresa" className="max-h-24 object-contain rounded" />
            <button
              type="button"
              onClick={() => setLogoUrl("")}
              className="absolute top-2 right-2 text-xs bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
              title="Quitar logo"
            >
              ×
            </button>
          </div>
        )}

        <div className="pt-4 border-t border-b-subtle flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2 bg-[var(--accent-blue)] hover:bg-blue-600 text-white font-semibold rounded-lg transition disabled:opacity-50"
          >
            {isPending ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SucursalesList({ sucursales }: { sucursales: Sucursal[] }) {
  return (
    <div className="space-y-4">
      {sucursales.map((suc, idx) => (
        <SucursalCard key={suc.id} sucursal={suc} index={idx + 1} />
      ))}
    </div>
  );
}

function SucursalCard({ sucursal, index }: { sucursal: Sucursal, index: number }) {
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nombre = formData.get("nombre") as string;
    const direccion = formData.get("direccion") as string;
    const telefono = formData.get("telefono") as string;

    startTransition(async () => {
      setSuccessMsg("");
      const result = await actualizarSucursal(sucursal.id, { nombre, direccion, telefono });
      if (result.success) {
        setSuccessMsg("Sucursal actualizada.");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        alert(result.error);
      }
    });
  };

  return (
    <div className="bg-card border border-b-default rounded-xl shadow-[var(--shadow-card)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 rounded bg-[var(--accent-blue)] text-white flex items-center justify-center text-xs font-bold">{index}</span>
        <h3 className="text-base font-bold text-t-primary uppercase tracking-wide">Configuración Sucursal</h3>
        {successMsg && <span className="ml-auto text-xs font-semibold text-t-green">✓ Guardado</span>}
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-semibold text-t-muted">Nombre</label>
            <input
              required
              name="nombre"
              defaultValue={sucursal.nombre}
              className="w-full px-3 py-1.5 text-sm bg-input border border-b-strong rounded focus:ring-2 focus:ring-[var(--accent-blue)] text-t-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-semibold text-t-muted">Teléfono</label>
            <input
              name="telefono"
              defaultValue={sucursal.telefono || ""}
              placeholder="Ej. +503 2222-2222"
              className="w-full px-3 py-1.5 text-sm bg-input border border-b-strong rounded focus:ring-2 focus:ring-[var(--accent-blue)] text-t-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-semibold text-t-muted">Dirección en Impresiones</label>
            <textarea
              name="direccion"
              defaultValue={sucursal.direccion || ""}
              placeholder="Dirección física completa..."
              rows={2}
              className="w-full px-3 py-1.5 text-sm bg-input border border-b-strong rounded focus:ring-2 focus:ring-[var(--accent-blue)] text-t-primary resize-none"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-1.5 text-xs bg-input border border-b-strong text-t-primary hover:bg-card hover:border-[var(--accent-blue)] font-semibold rounded transition disabled:opacity-50"
          >
            {isPending ? "Guardando..." : "Actualizar"}
          </button>
        </div>
      </form>
    </div>
  );
}
