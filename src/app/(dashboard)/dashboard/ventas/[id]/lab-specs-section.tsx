"use client";

import { useState } from "react";

interface LabSpec {
  tipo_lente: string | null;
  color_lente: string | null;
  material_lente: string | null;
  tratamiento_lente: string | null;
  marca_aro: string | null;
  color_aro: string | null;
  tamano_aro: string | null;
  tipo_aro: string | null;
  horizontal_aro: string | null;
  vertical_aro: string | null;
  diagonal_aro: string | null;
  puente_aro: string | null;
  varilla_aro: string | null;
  dp_od: string | null;
  dp_oi: string | null;
  dp: string | null;
  altura: string | null;
  observaciones: string | null;
}

export default function LabSpecsSection({ labSpecs }: { labSpecs: LabSpec }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-card border border-b-default rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 border-b border-b-subtle bg-a-blue-bg/20 flex items-center justify-between hover:bg-a-blue-bg/30 transition"
      >
        <h2 className="text-sm font-semibold text-t-blue uppercase tracking-wider flex items-center gap-2">
          <span>🔬</span> Especificaciones de Laboratorio
        </h2>
        <span className="text-lg text-t-secondary">{isOpen ? "▼" : "▶"}</span>
      </button>

      {isOpen && (
        <div className="p-6 space-y-6">
          {/* Lentes */}
          <div>
            <h3 className="text-xs font-bold text-t-muted uppercase mb-3">Lentes</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <LabField label="Tipo" value={labSpecs.tipo_lente} />
              <LabField label="Color" value={labSpecs.color_lente} />
              <LabField label="Material" value={labSpecs.material_lente} />
              <LabField label="Tratamiento" value={labSpecs.tratamiento_lente} />
            </div>
          </div>

          {/* Aro */}
          <div>
            <h3 className="text-xs font-bold text-t-muted uppercase mb-3">Aro</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <LabField label="Marca" value={labSpecs.marca_aro} />
              <LabField label="Color" value={labSpecs.color_aro} />
              <LabField label="Tamaño" value={labSpecs.tamano_aro} />
              <LabField label="Tipo" value={labSpecs.tipo_aro} />
              <LabField label="H" value={labSpecs.horizontal_aro} />
              <LabField label="V" value={labSpecs.vertical_aro} />
              <LabField label="D" value={labSpecs.diagonal_aro} />
              <LabField label="Puente" value={labSpecs.puente_aro} />
              <LabField label="Varilla" value={labSpecs.varilla_aro} />
            </div>
          </div>

          {/* Medidas */}
          <div>
            <h3 className="text-xs font-bold text-t-muted uppercase mb-3">Medidas</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <LabField label="DP OD" value={labSpecs.dp_od} />
              <LabField label="DP OI" value={labSpecs.dp_oi} />
              <LabField label="DP Total" value={labSpecs.dp} />
              <LabField label="Altura" value={labSpecs.altura} />
            </div>
          </div>

          {labSpecs.observaciones && (
            <div className="mt-4 p-4 bg-input rounded-xl border border-b-default">
              <h3 className="text-xs font-bold text-t-muted uppercase mb-1">Observaciones de Lab</h3>
              <p className="text-sm text-t-secondary whitespace-pre-wrap">{labSpecs.observaciones}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LabField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-[10px] sm:text-xs text-t-muted tracking-wider block mb-0.5">{label}</span>
      <p className="text-sm text-t-primary font-medium">{value || "—"}</p>
    </div>
  );
}
