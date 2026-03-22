"use client";

import { useState, useTransition, useEffect } from "react";
import { crearExamen, obtenerUltimaRefraccion } from "../actions";

interface Props {
  pacientes: { id: string; nombre: string }[];
  defaultPacienteId?: string;
}

type RefraccionFields = {
  ra_od_esfera: string; ra_od_cilindro: string; ra_od_eje: string; ra_od_adicion: string;
  ra_oi_esfera: string; ra_oi_cilindro: string; ra_oi_eje: string; ra_oi_adicion: string;
  rf_od_esfera: string; rf_od_cilindro: string; rf_od_eje: string; rf_od_adicion: string;
  rf_oi_esfera: string; rf_oi_cilindro: string; rf_oi_eje: string; rf_oi_adicion: string;
};

const EMPTY: RefraccionFields = {
  ra_od_esfera: "", ra_od_cilindro: "", ra_od_eje: "", ra_od_adicion: "",
  ra_oi_esfera: "", ra_oi_cilindro: "", ra_oi_eje: "", ra_oi_adicion: "",
  rf_od_esfera: "", rf_od_cilindro: "", rf_od_eje: "", rf_od_adicion: "",
  rf_oi_esfera: "", rf_oi_cilindro: "", rf_oi_eje: "", rf_oi_adicion: "",
};

const LENTE_USO_OPTIONS = ["Lejos", "Cerca", "Bifocal", "Progresivo", "Ocupacional", "Otro"];

export default function ExamenFormClient({ pacientes, defaultPacienteId }: Props) {
  const [pacienteId, setPacienteId] = useState(defaultPacienteId || "");
  const [fields, setFields] = useState<RefraccionFields>(EMPTY);
  const [lente_uso, setLenteUso] = useState("");
  const [av_od, setAvOd] = useState("");
  const [av_oi, setAvOi] = useState("");
  const [dp, setDp] = useState("");
  const [altura, setAltura] = useState("");
  const [motivo_consulta, setMotivoConsulta] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [isPending, startTransition] = useTransition();
  const [importMsg, setImportMsg] = useState("");

  // Searchable dropdown state
  const [searchPatient, setSearchPatient] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const updateField = (key: keyof RefraccionFields, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const doImport = (id: string) => {
    if (!id) return;
    setImportMsg("Cargando...");
    startTransition(async () => {
      const data = await obtenerUltimaRefraccion(id);
      if (!data) { setImportMsg("Sin exámenes previos para este paciente"); return; }
      setFields((prev) => ({
        ...prev,
        ra_od_esfera: data.rf_od_esfera?.toString() ?? "",
        ra_od_cilindro: data.rf_od_cilindro?.toString() ?? "",
        ra_od_eje: data.rf_od_eje?.toString() ?? "",
        ra_od_adicion: data.rf_od_adicion?.toString() ?? "",
        ra_oi_esfera: data.rf_oi_esfera?.toString() ?? "",
        ra_oi_cilindro: data.rf_oi_cilindro?.toString() ?? "",
        ra_oi_eje: data.rf_oi_eje?.toString() ?? "",
        ra_oi_adicion: data.rf_oi_adicion?.toString() ?? "",
      }));
      if (data.lente_uso) setLenteUso(data.lente_uso);
      if (data.dp) setDp(data.dp.toString());
      if (data.altura) setAltura(data.altura.toString());
      setImportMsg("✓ Refracción importada (RF anterior → RA actual)");
    });
  };

  const handleImport = () => {
    if (!pacienteId) { setImportMsg("Selecciona un paciente primero"); return; }
    doImport(pacienteId);
  };

  useEffect(() => {
    if (defaultPacienteId) {
      const p = pacientes.find(p => p.id === defaultPacienteId);
      if (p) setSearchPatient(p.nombre);
      doImport(defaultPacienteId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredPacientes = pacientes.filter(p => p.nombre.toLowerCase().includes(searchPatient.toLowerCase()));

  return (
    <form className="space-y-6">
      <input type="hidden" name="paciente_id" value={pacienteId} />

      {/* Patient selector (Searchable) */}
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <label className="block text-sm font-medium text-t-secondary mb-1.5">Paciente *</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchPatient}
            onChange={(e) => {
              setSearchPatient(e.target.value);
              setShowDropdown(true);
              setPacienteId("");
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          {showDropdown && filteredPacientes.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-card border border-b-default rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {filteredPacientes.map((p) => (
                <div
                  key={p.id}
                  className="px-4 py-2 hover:bg-input cursor-pointer text-t-primary text-sm transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent onBlur from firing before click
                    setPacienteId(p.id);
                    setSearchPatient(p.nombre);
                    setShowDropdown(false);
                    setImportMsg("");
                    doImport(p.id); // Auto-load previous refraction!
                  }}
                >
                  {p.nombre}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Extra fields: Motivo Consulta, Lente-Uso, AV, DP, Altura */}
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold text-t-primary mb-4">Datos del Examen</h2>
        
        <div className="mb-4">
          <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Motivo de Consulta</label>
          <input name="motivo_consulta" value={motivo_consulta} onChange={(e) => setMotivoConsulta(e.target.value)}
            placeholder="Ej: Visión borrosa, ardor, chequeo rutinario..." type="text"
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Lente-Uso */}
          <div>
            <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Lente - Uso</label>
            <select name="lente_uso" value={lente_uso} onChange={(e) => setLenteUso(e.target.value)}
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm">
              <option value="">Seleccionar...</option>
              {LENTE_USO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          {/* AV OD sin lentes */}
          <div>
            <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">
              AV OD <span className="normal-case text-t-blue">(sin lentes)</span>
            </label>
            <input name="av_od_sin_lentes" value={av_od} onChange={(e) => setAvOd(e.target.value)}
              placeholder="Ej: 20/40" type="text"
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm" />
          </div>
          {/* AV OI sin lentes */}
          <div>
            <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">
              AV OI <span className="normal-case text-t-purple">(sin lentes)</span>
            </label>
            <input name="av_oi_sin_lentes" value={av_oi} onChange={(e) => setAvOi(e.target.value)}
              placeholder="Ej: 20/30" type="text"
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm" />
          </div>
          {/* DP */}
          <div>
            <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">DP (mm)</label>
            <input name="dp" value={dp} onChange={(e) => setDp(e.target.value)}
              placeholder="Ej: 63" type="number" step="0.5"
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          {/* Altura */}
          <div>
            <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Altura (mm)</label>
            <input name="altura" value={altura} onChange={(e) => setAltura(e.target.value)}
              placeholder="Ej: 20" type="number" step="0.5"
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
        </div>
      </div>

      {/* RA */}
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-t-primary">Refracción Actual (RA)</h2>
            <p className="text-xs text-t-muted mt-0.5">Graduación que el paciente lleva actualmente</p>
          </div>
          <button type="button" onClick={handleImport} disabled={isPending}
            className="px-3 py-1.5 text-xs font-medium bg-a-amber-bg text-t-amber border border-a-amber-border rounded-lg hover:opacity-80 transition disabled:opacity-50">
            {isPending ? "Importando..." : "📋 Importar última RF"}
          </button>
        </div>
        {importMsg && <p className={`text-xs mb-3 ${importMsg.startsWith("✓") ? "text-t-green" : "text-t-amber"}`}>{importMsg}</p>}
        <RefraccionGrid prefix="ra" fields={fields} onChange={updateField} />
      </div>

      {/* RF */}
      <div className="p-6 bg-a-blue-bg border border-[var(--accent-blue)] rounded-2xl">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-t-primary">Refracción Final (RF)</h2>
          <p className="text-xs text-t-muted mt-0.5">Nueva graduación prescrita en este examen</p>
        </div>
        <RefraccionGrid prefix="rf" fields={fields} onChange={updateField} />
      </div>

      {/* Observaciones */}
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <label className="block text-sm font-medium text-t-secondary mb-1.5">Observaciones</label>
        <textarea name="observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
          rows={3} placeholder="Notas del examen, hallazgos, recomendaciones..."
          className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none" />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button formAction={crearExamen}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/25">
          Guardar examen
        </button>
        <a href="/dashboard/examenes"
          className="px-6 py-2.5 bg-card border border-b-default text-t-secondary hover:text-t-primary rounded-lg transition-colors inline-flex items-center">
          Cancelar
        </a>
      </div>
    </form>
  );
}

function RefraccionGrid({ prefix, fields, onChange }: {
  prefix: "ra" | "rf"; fields: RefraccionFields; onChange: (key: keyof RefraccionFields, value: string) => void;
}) {
  const cols = [
    { key: "esfera", label: "Esfera", step: "0.25", placeholder: "±0.00" },
    { key: "cilindro", label: "Cilindro", step: "0.25", placeholder: "-0.00" },
    { key: "eje", label: "Eje (°)", step: "1", placeholder: "0-180" },
    { key: "adicion", label: "Adición", step: "0.25", placeholder: "+0.00" },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left py-2 pr-3 text-xs font-medium text-t-muted uppercase w-12">Ojo</th>
            {cols.map((c) => <th key={c.key} className="text-center py-2 px-1 text-xs font-medium text-t-muted uppercase">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {(["od", "oi"] as const).map((ojo) => (
            <tr key={ojo}>
              <td className="py-1 pr-3">
                <span className={`text-sm font-bold ${ojo === "od" ? "text-t-blue" : "text-t-purple"}`}>{ojo.toUpperCase()}</span>
              </td>
              {cols.map((c) => {
                const fieldKey = `${prefix}_${ojo}_${c.key}` as keyof RefraccionFields;
                return (
                  <td key={c.key} className="py-1 px-1">
                    <input type="number" name={fieldKey} value={fields[fieldKey]} onChange={(e) => onChange(fieldKey, e.target.value)}
                      step={c.step} placeholder={c.placeholder}
                      className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary text-center text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
