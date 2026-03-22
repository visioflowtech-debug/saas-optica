"use client";

import { useState, useTransition } from "react";
import { obtenerOrdenesParaListaPDF } from "./actions";
import { generarListaOrdenesLaboratorioPDF } from "./lista-pdf";

interface Props {
  laboratorios: { id: string; nombre: string }[];
  campanas: { id: string; nombre: string }[];
}

const selectCls =
  "w-full px-3 py-2 text-sm bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:border-blue-500";
const labelCls = "text-[10px] text-t-muted uppercase tracking-wider block mb-1";

export default function ListaPDFButton({ laboratorios, campanas }: Props) {
  const [open, setOpen] = useState(false);
  const [labId, setLabId] = useState("");
  const [campanaId, setCampanaId] = useState("");
  const [estado, setEstado] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleGenerar = () => {
    startTransition(async () => {
      const ordenes = await obtenerOrdenesParaListaPDF({
        laboratorio_id: labId || undefined,
        campana_id: campanaId || undefined,
        estado: estado || undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      });

      if (ordenes.length === 0) {
        alert("No hay órdenes que coincidan con los filtros seleccionados.");
        return;
      }

      const labNombre = labId ? laboratorios.find((l) => l.id === labId)?.nombre : undefined;
      const campanaNombre = campanaId ? campanas.find((c) => c.id === campanaId)?.nombre : undefined;

      generarListaOrdenesLaboratorioPDF(ordenes, {
        laboratorio: labNombre,
        campana: campanaNombre,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
      });
      setOpen(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-semibold bg-card border border-b-default text-t-secondary hover:text-t-primary rounded-xl transition flex items-center gap-2"
      >
        📄 Generar Lista PDF
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl shadow-2xl space-y-4 bg-card border border-b-default">
            <h3 className="text-base font-bold text-t-primary">Generar Lista de Órdenes</h3>
            <p className="text-xs text-t-muted">Selecciona filtros opcionales para la lista PDF.</p>

            <div className="space-y-3">
              {/* Laboratorio */}
              <div>
                <label className={labelCls}>Laboratorio</label>
                <select value={labId} onChange={(e) => setLabId(e.target.value)} className={selectCls}>
                  <option value="">Todos los laboratorios</option>
                  {laboratorios.map((l) => (
                    <option key={l.id} value={l.id}>{l.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Campaña */}
              {campanas.length > 0 && (
                <div>
                  <label className={labelCls}>Campaña</label>
                  <select value={campanaId} onChange={(e) => setCampanaId(e.target.value)} className={selectCls}>
                    <option value="">Todas las campañas</option>
                    {campanas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Estado */}
              <div>
                <label className={labelCls}>Estado</label>
                <select value={estado} onChange={(e) => setEstado(e.target.value)} className={selectCls}>
                  <option value="">Todos los estados</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="en_laboratorio">En Laboratorio</option>
                  <option value="recibido">Recibido</option>
                  <option value="entregado">Entregado</option>
                </select>
              </div>

              {/* Rango de fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Fecha desde</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className={selectCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Fecha hasta</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className={selectCls}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleGenerar}
                disabled={isPending}
                className="flex-1 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50"
              >
                {isPending ? "Generando..." : "📄 Generar PDF"}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm text-t-muted border border-b-default rounded-lg hover:text-t-primary transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
