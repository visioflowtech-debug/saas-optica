"use client";

import { useState, useTransition } from "react";
import { obtenerOrdenesParaListaPDF } from "./actions";
import { generarListaOrdenesLaboratorioPDF } from "./lista-pdf";

interface Props {
  laboratorios: { id: string; nombre: string }[];
}

export default function ListaPDFButton({ laboratorios }: Props) {
  const [open, setOpen] = useState(false);
  const [labId, setLabId] = useState("");
  const [estado, setEstado] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleGenerar = () => {
    startTransition(async () => {
      const ordenes = await obtenerOrdenesParaListaPDF({
        laboratorio_id: labId || undefined,
        estado: estado || undefined,
      });

      if (ordenes.length === 0) {
        alert("No hay órdenes que coincidan con los filtros seleccionados.");
        return;
      }

      const labNombre = labId ? laboratorios.find((l) => l.id === labId)?.nombre : undefined;
      generarListaOrdenesLaboratorioPDF(ordenes, { laboratorio: labNombre });
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
          <div className="w-full max-w-sm p-6 rounded-2xl shadow-2xl space-y-4 bg-card border border-b-default">
            <h3 className="text-base font-bold text-t-primary">Generar Lista de Órdenes</h3>
            <p className="text-xs text-t-muted">Selecciona filtros opcionales para la lista PDF.</p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-t-muted uppercase tracking-wider block mb-1">Laboratorio</label>
                <select
                  value={labId}
                  onChange={(e) => setLabId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:border-blue-500"
                >
                  <option value="">Todos los laboratorios</option>
                  {laboratorios.map((l) => (
                    <option key={l.id} value={l.id}>{l.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-t-muted uppercase tracking-wider block mb-1">Estado</label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:border-blue-500"
                >
                  <option value="">Todos los estados</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="en_laboratorio">En Laboratorio</option>
                  <option value="recibido">Recibido</option>
                  <option value="entregado">Entregado</option>
                </select>
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
