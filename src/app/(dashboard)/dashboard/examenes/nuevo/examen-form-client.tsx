"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { crearExamen, obtenerUltimaRefraccion } from "../actions";

interface Props {
  pacientes: { id: string; nombre: string }[];
  optometristas: { id: string; nombre: string; activo: boolean }[];
  defaultPacienteId?: string;
  campanaId?: string;
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

export default function ExamenFormClient({ pacientes, optometristas, defaultPacienteId, campanaId }: Props) {
  const [pacienteId, setPacienteId] = useState(defaultPacienteId || "");
  const [fields, setFields] = useState<RefraccionFields>(EMPTY);
  // PL (Plano) state por cada ojo/prefijo: ra_od, ra_oi, rf_od, rf_oi
  const [plano, setPlano] = useState({ ra_od: false, ra_oi: false, rf_od: false, rf_oi: false });
  const [optometristaNombre, setOptometristaNombre] = useState(optometristas[0]?.nombre ?? "");
  const [lente_uso, setLenteUso] = useState("");
  const [av_od, setAvOd] = useState("");
  const [av_oi, setAvOi] = useState("");
  const [dp, setDp] = useState("");
  const [dp_oi, setDpOi] = useState("");
  const [altura, setAltura] = useState("");
  const [motivo_consulta, setMotivoConsulta] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [isPending, startTransition] = useTransition();
  const [importMsg, setImportMsg] = useState("");

  // Searchable dropdown state
  const [searchPatient, setSearchPatient] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchPatient), 200);
    return () => clearTimeout(t);
  }, [searchPatient]);

  const updateField = (key: keyof RefraccionFields, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const togglePlano = (ojoKey: "ra_od" | "ra_oi" | "rf_od" | "rf_oi") => {
    const next = !plano[ojoKey];
    setPlano((prev) => ({ ...prev, [ojoKey]: next }));
    // Si se activa PL → esfera = "0"; si se desactiva → limpiar
    const esfKey = `${ojoKey}_esfera` as keyof RefraccionFields;
    setFields((prev) => ({ ...prev, [esfKey]: next ? "0" : "" }));
  };

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
      if (data.dp_oi) setDpOi(data.dp_oi.toString());
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

  const filteredPacientes = pacientes.filter(p => p.nombre.toLowerCase().includes(debouncedSearch.toLowerCase()));

  return (
    <form className="space-y-6">
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <input type="hidden" name="optometrista_nombre" value={optometristaNombre} />
      {campanaId && <input type="hidden" name="campana_id" value={campanaId} />}

      {/* Patient selector (Searchable) */}
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <label className="block text-sm font-medium text-t-secondary mb-1.5">Paciente *</label>
        <div className="relative">
          <input
            type="search"
            placeholder="Buscar por nombre..."
            value={searchPatient}
            aria-label="Buscar paciente"
            aria-autocomplete="list"
            aria-expanded={showDropdown && filteredPacientes.length > 0}
            onChange={(e) => {
              setSearchPatient(e.target.value);
              setShowDropdown(true);
              setActiveIndex(-1);
              setPacienteId("");
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => { setShowDropdown(false); setActiveIndex(-1); }, 200)}
            onKeyDown={(e) => {
              if (!showDropdown || filteredPacientes.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex(i => Math.min(i + 1, filteredPacientes.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex(i => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && activeIndex >= 0) {
                e.preventDefault();
                const p = filteredPacientes[activeIndex];
                setPacienteId(p.id); setSearchPatient(p.nombre);
                setShowDropdown(false); setActiveIndex(-1); setImportMsg("");
                doImport(p.id);
              } else if (e.key === "Escape") {
                setShowDropdown(false); setActiveIndex(-1);
              }
            }}
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          {showDropdown && filteredPacientes.length > 0 && (
            <div ref={dropdownRef} role="listbox" className="absolute z-20 w-full mt-1 bg-sidebar border border-b-default rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.25)] max-h-60 overflow-y-auto">
              {filteredPacientes.map((p, idx) => (
                <div
                  key={p.id}
                  role="option"
                  aria-selected={idx === activeIndex}
                  className={`px-4 py-2.5 cursor-pointer text-t-primary text-sm transition-colors ${idx === activeIndex ? "bg-blue-600 text-white" : "hover:bg-input"}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setPacienteId(p.id); setSearchPatient(p.nombre);
                    setShowDropdown(false); setActiveIndex(-1); setImportMsg("");
                    doImport(p.id);
                  }}
                >
                  {p.nombre}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Optometrista */}
      {optometristas.length > 0 && (
        <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
          <label className="block text-sm font-medium text-t-secondary mb-1.5">Optometrista</label>
          <div className="flex flex-wrap gap-2">
            {optometristas.filter((o) => o.activo).map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOptometristaNombre(o.nombre)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${
                  optometristaNombre === o.nombre
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-card border-b-default text-t-secondary hover:text-t-primary"
                }`}
              >
                {o.nombre}
              </button>
            ))}
          </div>
          {optometristaNombre && (
            <p className="text-xs text-t-muted mt-2">Firmando como: <span className="font-medium text-t-primary">{optometristaNombre}</span></p>
          )}
        </div>
      )}

      {/* Extra fields: Motivo Consulta, Lente-Uso, AV, DP, Altura */}
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold text-t-primary mb-4">Datos del Examen</h2>
        
        <div className="mb-4">
          <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Motivo de Consulta</label>
          <input name="motivo_consulta" value={motivo_consulta} onChange={(e) => setMotivoConsulta(e.target.value)}
            placeholder="Ej: Visión borrosa, ardor, chequeo rutinario..." type="text"
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-base sm:text-sm" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Lente-Uso */}
          <div>
            <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Lente - Uso</label>
            <select name="lente_uso" value={lente_uso} onChange={(e) => setLenteUso(e.target.value)}
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-base sm:text-sm">
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
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-base sm:text-sm" />
          </div>
          {/* AV OI sin lentes */}
          <div>
            <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">
              AV OI <span className="normal-case text-t-purple">(sin lentes)</span>
            </label>
            <input name="av_oi_sin_lentes" value={av_oi} onChange={(e) => setAvOi(e.target.value)}
              placeholder="Ej: 20/30" type="text"
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-base sm:text-sm" />
          </div>
          {/* DP OD */}
          <div>
            <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">
              DP <span className="normal-case text-t-blue font-semibold">OD</span> (mm)
            </label>
            <input name="dp" value={dp} onChange={(e) => setDp(e.target.value)}
              placeholder="Ej: 32" type="number" step="0.5"
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          {/* DP OI */}
          <div>
            <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">
              DP <span className="normal-case text-t-purple font-semibold">OI</span> (mm)
            </label>
            <input name="dp_oi" value={dp_oi} onChange={(e) => setDpOi(e.target.value)}
              placeholder="Ej: 31" type="number" step="0.5"
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
            className="px-3 py-2.5 min-h-11 text-xs font-medium bg-a-amber-bg text-t-amber border border-a-amber-border rounded-lg hover:opacity-80 transition disabled:opacity-50">
            {isPending ? "Importando..." : "📋 Importar última RF"}
          </button>
        </div>
        {importMsg && <p className={`text-xs mb-3 ${importMsg.startsWith("✓") ? "text-t-green" : "text-t-amber"}`}>{importMsg}</p>}
        <RefraccionGrid prefix="ra" fields={fields} onChange={updateField} plano={plano} onTogglePlano={togglePlano} />
      </div>

      {/* RF */}
      <div className="p-6 bg-a-blue-bg border border-[var(--accent-blue)] rounded-2xl">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-t-primary">Refracción Final (RF)</h2>
          <p className="text-xs text-t-muted mt-0.5">Nueva graduación prescrita en este examen</p>
        </div>
        <RefraccionGrid prefix="rf" fields={fields} onChange={updateField} plano={plano} onTogglePlano={togglePlano} />
      </div>

      {/* Observaciones */}
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <label className="block text-sm font-medium text-t-secondary mb-1.5">Observaciones</label>
        <textarea name="observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
          rows={3} placeholder="Notas del examen, hallazgos, recomendaciones..."
          className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none text-base sm:text-sm" />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button formAction={crearExamen}
          className="px-6 py-2.5 min-h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/25">
          Guardar examen
        </button>
        <a href="/dashboard/examenes"
          className="px-6 py-2.5 min-h-11 bg-card border border-b-default text-t-secondary hover:text-t-primary rounded-lg transition-colors inline-flex items-center">
          Cancelar
        </a>
      </div>
    </form>
  );
}

type PlanoState = { ra_od: boolean; ra_oi: boolean; rf_od: boolean; rf_oi: boolean };

function RefraccionGrid({ prefix, fields, onChange, plano, onTogglePlano }: {
  prefix: "ra" | "rf";
  fields: RefraccionFields;
  onChange: (key: keyof RefraccionFields, value: string) => void;
  plano: PlanoState;
  onTogglePlano: (ojoKey: "ra_od" | "ra_oi" | "rf_od" | "rf_oi") => void;
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
          {(["od", "oi"] as const).map((ojo) => {
            const ojoKey = `${prefix}_${ojo}` as "ra_od" | "ra_oi" | "rf_od" | "rf_oi";
            const isPL = plano[ojoKey];
            return (
              <tr key={ojo}>
                <td className="py-1 pr-3">
                  <span className={`text-sm font-bold ${ojo === "od" ? "text-t-blue" : "text-t-purple"}`}>{ojo.toUpperCase()}</span>
                </td>
                {cols.map((c) => {
                  const fieldKey = `${prefix}_${ojo}_${c.key}` as keyof RefraccionFields;
                  const isEsfera = c.key === "esfera";
                  return (
                    <td key={c.key} className="py-1 px-1">
                      {isEsfera ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="relative">
                            <input
                              type="number" name={fieldKey}
                              value={isPL ? "0" : fields[fieldKey]}
                              onChange={(e) => onChange(fieldKey, e.target.value)}
                              step={c.step} placeholder={isPL ? "PL" : c.placeholder}
                              disabled={isPL}
                              className={`w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary text-center text-base sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isPL ? "opacity-0 absolute" : ""}`}
                            />
                            {isPL && (
                              <div className="w-full px-3 py-2 bg-a-blue-bg border border-[var(--accent-blue)] rounded-lg text-t-blue text-center text-sm font-bold font-mono">
                                PL
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onTogglePlano(ojoKey)}
                            className={`text-[10px] font-medium rounded px-1 py-0.5 transition ${
                              isPL
                                ? "bg-a-blue-bg text-t-blue border border-[var(--accent-blue)]"
                                : "bg-badge text-t-muted border border-b-default hover:text-t-primary"
                            }`}
                          >
                            {isPL ? "✓ PL" : "PL"}
                          </button>
                        </div>
                      ) : (
                        <input type="number" name={fieldKey} value={fields[fieldKey]} onChange={(e) => onChange(fieldKey, e.target.value)}
                          step={c.step} placeholder={c.placeholder}
                          className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary text-center text-base sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
