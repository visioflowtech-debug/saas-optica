"use client";

import { useState, useTransition } from "react";
import { actualizarEstado, convertirAOrden, anularOrden, obtenerDatosTicket } from "../actions";
import { generarTicketPDF } from "../ticket-pdf";
import { obtenerDatosSobreLaboratorio } from "../../laboratorio/actions";
import { generarSobreLaboratorioPDF } from "../../laboratorio/sobre-pdf";
import KanbanModal from "../../laboratorio/kanban-modal";

interface Props {
  ordenId: string;
  tipo: string;
  estado: string;
}

export default function OrdenAcciones({ ordenId, tipo, estado }: Props) {
  const [isPending, startTransition] = useTransition();
  const [printing, setPrinting] = useState(false);
  const [showLabModal, setShowLabModal] = useState(false);

  const handleEstado = (nuevoEstado: string) => {
    startTransition(async () => {
      await actualizarEstado(ordenId, nuevoEstado);
    });
  };

  const handleConvertir = () => {
    startTransition(async () => {
      await convertirAOrden(ordenId);
      // After converting, open the lab details modal so the user can fill it out immediately
      setShowLabModal(true);
    });
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const data = await obtenerDatosTicket(ordenId);
      if (!data) { alert("No se encontraron datos"); return; }
      await generarTicketPDF(data as Parameters<typeof generarTicketPDF>[0]);
    } catch {
      alert("Error al generar ticket");
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintSobre = async () => {
    setPrinting(true);
    try {
      const data = await obtenerDatosSobreLaboratorio(ordenId);
      await generarSobreLaboratorioPDF(data as any);
    } catch {
      alert("Error al generar sobre de laboratorio");
    } finally {
      setPrinting(false);
    }
  };

  // Determine available actions based on current state
  const isProforma = tipo === "proforma";
  const isBorrador = estado === "borrador";
  const isConfirmada = estado === "confirmada";
  const isCancelada = estado === "cancelada";
  const isFacturada = estado === "facturada";

  if (isCancelada) {
    return (
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <p className="text-center text-sm text-t-muted mb-4">
          Esta {isProforma ? "proforma" : "orden"} está cancelada. No se pueden realizar más acciones.
        </p>
        <div className="flex justify-center">
          <button
            onClick={handlePrint}
            disabled={printing}
            className="px-4 py-2 bg-card border border-b-default text-t-secondary text-sm font-medium rounded-lg hover:text-t-primary transition disabled:opacity-50"
          >
            {printing ? "..." : "🖨️ Imprimir Ticket"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold text-t-primary uppercase tracking-wider mb-4">Acciones</h2>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handlePrint}
          disabled={printing}
          className="px-4 py-2 bg-card border border-b-default text-t-secondary text-sm font-medium rounded-lg hover:text-t-primary transition disabled:opacity-50"
        >
          {printing ? "..." : "🖨️ Imprimir Ticket"}
        </button>

        {/* Print Envelope (Only for Orden de Trabajo) */}
        {!isProforma && (
          <button
            onClick={handlePrintSobre}
            disabled={printing}
            className="px-4 py-2 bg-a-blue-bg text-t-blue border border-[var(--accent-blue)] text-sm font-medium rounded-lg hover:opacity-80 transition disabled:opacity-50"
          >
            {printing ? "..." : "🖨️ Imprimir Sobre Lab"}
          </button>
        )}

        {/* Confirm (borrador → confirmada) */}
        {isBorrador && (
          <button
            onClick={() => handleEstado("confirmada")}
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
          >
            {isPending ? "..." : "✓ Confirmar"}
          </button>
        )}

        {/* Convert to Orden (proforma + confirmada → orden_trabajo) */}
        {isProforma && isConfirmada && (
          <button
            onClick={handleConvertir}
            disabled={isPending}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
          >
            {isPending ? "..." : "🔄 Convertir a Orden de Trabajo"}
          </button>
        )}

        {/* Mark as Invoiced (confirmada → facturada) */}
        {isConfirmada && !isProforma && (
          <button
            onClick={() => handleEstado("facturada")}
            disabled={isPending}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
          >
            {isPending ? "..." : "💰 Marcar Facturada"}
          </button>
        )}

        {/* Cancel / Anular */}
        {!isCancelada && (
          <button
            onClick={() => {
              if (confirm("¿Estás seguro de anular/cancelar esta " + (isProforma ? "proforma" : "orden") + "?")) {
                startTransition(async () => {
                   await anularOrden(ordenId);
                });
              }
            }}
            disabled={isPending}
            className="px-4 py-2 bg-card border border-red-500/30 text-t-red text-sm font-medium rounded-lg hover:bg-red-500/10 transition disabled:opacity-50"
          >
            {isPending ? "..." : isFacturada ? "✕ Anular Venta" : "✕ Cancelar"}
          </button>
        )}
      </div>

      {/* Lab details capture on conversion */}
      {showLabModal && (
        <KanbanModal 
          isOpen={showLabModal} 
          onClose={() => setShowLabModal(false)} 
          ordenId={ordenId}
          onSuccess={() => setShowLabModal(false)}
        />
      )}
    </div>
  );
}
