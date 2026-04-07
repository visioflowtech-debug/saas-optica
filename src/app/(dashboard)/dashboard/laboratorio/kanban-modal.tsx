"use client";

import { useEffect, useState, useTransition } from "react";
import { obtenerDatosParaModalLab, guardarDatosLaboratorio, obtenerLaboratoriosActivos } from "./actions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ordenId: string | null;
  onSuccess?: () => void;
}

export default function KanbanModal({ isOpen, onClose, ordenId, onSuccess }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, startTransition] = useTransition();

  const [labs, setLabs] = useState<{ id: string; nombre: string }[]>([]);
  const [formData, setFormData] = useState({
    laboratorio_id: "",
    tipo_lente: "", color_lente: "", material_lente: "", tratamiento_lente: "",
    marca_aro: "", color_aro: "", tamano_aro: "", horizontal_aro: "", vertical_aro: "",
    diagonal_aro: "", puente_aro: "", varilla_aro: "", tipo_aro: "",
    dp_od: "", dp_oi: "", dp: "", altura: "", observaciones: ""
  });

  useEffect(() => {
    obtenerLaboratoriosActivos().then(setLabs);
  }, []);

  useEffect(() => {
    if (isOpen && ordenId) {
      setLoading(true);
      obtenerDatosParaModalLab(ordenId)
        .then((res) => {
          setData(res);
          const d = res.laboratorioDatos;
          const ex = res.examen;
          setFormData({
            laboratorio_id: d?.laboratorio_id || "",
            tipo_lente: d?.tipo_lente || "",
            color_lente: d?.color_lente || "",
            material_lente: d?.material_lente || "",
            tratamiento_lente: d?.tratamiento_lente || "",
            marca_aro: d?.marca_aro || "",
            color_aro: d?.color_aro || "",
            tamano_aro: d?.tamano_aro || "",
            horizontal_aro: d?.horizontal_aro || "",
            vertical_aro: d?.vertical_aro || "",
            diagonal_aro: d?.diagonal_aro || "",
            puente_aro: d?.puente_aro || "",
            varilla_aro: d?.varilla_aro || "",
            tipo_aro: d?.tipo_aro || "",
            dp_od: d?.dp_od || "",
            dp_oi: d?.dp_oi || "",
            dp: d?.dp || (ex?.dp ? String(ex.dp) : ""),
            altura: d?.altura || (ex?.altura ? String(ex.altura) : ""),
            observaciones: d?.observaciones || ""
          });
        })
        .finally(() => setLoading(false));
    } else {
      setData(null);
    }
  }, [isOpen, ordenId]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ordenId) return;
    startTransition(async () => {
      try {
        await guardarDatosLaboratorio(ordenId, formData);
        if (onSuccess) onSuccess();
        onClose();
      } catch (err) {
        alert("Error al guardar datos de laboratorio: " + (err instanceof Error ? err.message : "Desconocido"));
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-lab-title"
    >
      <div className="bg-background w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-b-default">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-b-default bg-card">
          <h2 id="modal-lab-title" className="text-lg font-bold text-t-primary">Detalles para Laboratorio</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="text-t-muted hover:text-red-500 font-bold min-w-[44px] min-h-11 px-2 rounded hover:bg-red-500/10 transition"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center p-10"><p className="text-t-muted">Cargando...</p></div>
          ) : data ? (
            <div className="space-y-8">
              {/* Resumen Orden */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-card p-4 rounded-xl border border-b-default shadow-[var(--shadow-card)]">
                <div>
                  <p className="text-xs text-t-muted uppercase font-bold">Orden #</p>
                  <p className="text-sm font-medium text-t-primary">{data.orden.id.split("-")[0].toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-xs text-t-muted uppercase font-bold">Paciente</p>
                  <p className="text-sm font-medium text-t-primary">{data.paciente.nombre}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs text-t-muted uppercase font-bold">Productos Base de la Orden</p>
                  <ul className="text-xs text-t-secondary list-disc pl-4 mt-1">
                    {data.detalles.map((d: any, i: number) => (
                      <li key={i}>{d.descripcion} ({d.cantidad})</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Formulario Custom */}
              <form id="lab-form" onSubmit={handleSave} className="space-y-6">

                {/* Laboratorio proveedor */}
                <div>
                  <h3 className="text-sm font-bold text-t-primary border-b border-b-subtle pb-2 mb-4">Proveedor de Laboratorio</h3>
                  <div className="max-w-xs">
                    <label htmlFor="field-laboratorio_id" className="block text-xs font-semibold text-t-secondary mb-1 uppercase">Laboratorio</label>
                    <select
                      id="field-laboratorio_id"
                      name="laboratorio_id"
                      value={formData.laboratorio_id}
                      onChange={handleChange}
                      className="w-full bg-input border border-b-default rounded-lg px-3 py-2 text-base sm:text-sm text-t-primary focus:outline-none focus:border-blue-500 transition"
                    >
                      <option value="">— Sin asignar —</option>
                      {labs.map((lab) => (
                        <option key={lab.id} value={lab.id}>{lab.nombre}</option>
                      ))}
                    </select>
                    {labs.length === 0 && (
                      <p className="text-[10px] text-t-muted mt-1">
                        Agrega laboratorios en Configuración → Laboratorios
                      </p>
                    )}
                  </div>
                </div>

                {/* Lentes */}
                <div>
                  <h3 className="text-sm font-bold text-t-primary border-b border-b-subtle pb-2 mb-4">Detalle de Lentes</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Tipo de Lentes" name="tipo_lente" val={formData.tipo_lente} onChange={handleChange} placeholder="Ej: Kodak precise, Transition" />
                    <Field label="Color de Lentes" name="color_lente" val={formData.color_lente} onChange={handleChange} placeholder="Ej: Blancos" />
                    <Field label="Material" name="material_lente" val={formData.material_lente} onChange={handleChange} placeholder="Ej: Policarbonato, CR39" />
                    <Field label="Tratamiento" name="tratamiento_lente" val={formData.tratamiento_lente} onChange={handleChange} placeholder="Ej: AR" />
                  </div>
                </div>

                {/* Aro */}
                <div>
                  <h3 className="text-sm font-bold text-t-primary border-b border-b-subtle pb-2 mb-4">Detalle del Aro</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Tipo de Aro" name="tipo_aro" val={formData.tipo_aro} onChange={handleChange} placeholder="Completo, Semi al aire, Al aire" />
                    <Field label="Marca" name="marca_aro" val={formData.marca_aro} onChange={handleChange} />
                    <Field label="Color" name="color_aro" val={formData.color_aro} onChange={handleChange} />
                    <Field label="Tamaño" name="tamano_aro" val={formData.tamano_aro} onChange={handleChange} />
                    <Field label="Horizontal" name="horizontal_aro" val={formData.horizontal_aro} onChange={handleChange} />
                    <Field label="Vertical" name="vertical_aro" val={formData.vertical_aro} onChange={handleChange} />
                    <Field label="Diagonal" name="diagonal_aro" val={formData.diagonal_aro} onChange={handleChange} />
                    <Field label="Puente" name="puente_aro" val={formData.puente_aro} onChange={handleChange} />
                    <Field label="Varilla" name="varilla_aro" val={formData.varilla_aro} onChange={handleChange} />
                  </div>
                </div>

                {/* Medidas */}
                <div>
                  <h3 className="text-sm font-bold text-t-primary border-b border-b-subtle pb-2 mb-4">Medidas del Paciente</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="DP OD" name="dp_od" val={formData.dp_od} onChange={handleChange} />
                    <Field label="DP OI" name="dp_oi" val={formData.dp_oi} onChange={handleChange} />
                    <Field label="DP Total" name="dp" val={formData.dp} onChange={handleChange} />
                    <Field label="Altura" name="altura" val={formData.altura} onChange={handleChange} />
                  </div>
                </div>

                {/* Observaciones */}
                <div>
                  <h3 className="text-sm font-bold text-t-primary pb-2 mb-2">Observaciones</h3>
                  <textarea
                    name="observaciones"
                    value={formData.observaciones}
                    onChange={handleChange}
                    className="w-full bg-input border border-b-default rounded-lg px-3 py-2 text-base sm:text-sm text-t-primary focus:outline-none focus:border-blue-500 transition h-20"
                    placeholder="Notas adicionales..."
                  />
                </div>
              </form>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-b-default bg-card flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} type="button" className="px-4 py-2.5 min-h-11 text-sm font-medium text-t-secondary hover:text-t-primary transition">
            Cancelar
          </button>
          <button
            type="submit"
            form="lab-form"
            disabled={isSaving || loading}
            className="px-6 py-2.5 min-h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 shadow-md shadow-blue-500/20"
          >
            {isSaving ? "Guardando..." : "Guardar Datos de Lab"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, val, onChange, placeholder }: { label: string, name: string, val: string, onChange: any, placeholder?: string }) {
  return (
    <div>
      <label htmlFor={`field-${name}`} className="block text-xs font-semibold text-t-secondary mb-1 uppercase">{label}</label>
      <input
        id={`field-${name}`}
        type="text"
        name={name}
        value={val}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-input border border-b-default rounded-lg px-3 py-2 text-base sm:text-sm text-t-primary focus:outline-none focus:border-blue-500 transition"
      />
    </div>
  );
}
