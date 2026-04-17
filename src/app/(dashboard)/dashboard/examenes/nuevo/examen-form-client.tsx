"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { crearExamen, actualizarExamen, obtenerUltimaRefraccion } from "../actions";

interface Props {
  buscarPacientes?: (q: string) => Promise<{ id: string; nombre: string }[]>;
  defaultPaciente?: { id: string; nombre: string } | null;
  optometristas?: { id: string; nombre: string; activo: boolean }[];
  campanaId?: string;
  examenInicial?: any | null;
  pacienteInicial?: { id: string; nombre: string; fecha_nacimiento?: string; edad?: number } | null;
  optometristasDisponibles?: string[];
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
const LENTE_MATERIAL_OPTIONS = ["CR-39", "Policarbonato", "Trivex", "1.67 Hi-Index", "1.74 Hi-Index", "Vidrio"];
const LENTE_COLOR_OPTIONS = ["Sin tinte", "Fotocromático", "Solar fijo", "Antirreflejo", "Filtro azul"];

const SINTOMAS_OPCIONES = [
  "Cefalea", "Visión borrosa", "Ardor ocular", "Irritación", "Fotofobia",
  "Lagrimeo", "Secreciones", "Diplopía", "Halos de luz", "Miodesopsias",
  "Dolor ocular", "Salto de letras", "Prurito", "Mareo", "Somnolencia", "Astenopias",
];

const SEGMENTOS_EXPLORACION = [
  { key: "parpados",        label: "Párpados" },
  { key: "conjuntiva",      label: "Conjuntiva" },
  { key: "cornea",          label: "Córnea" },
  { key: "iris",            label: "Iris" },
  { key: "cristalino",      label: "Cristalino" },
  { key: "reflejo_pupilar", label: "Reflejo pupilar" },
  { key: "mov_oculares",    label: "Mov. oculares" },
];

type SegmentoExp = { nl: boolean | null; nota: string };
type ExploracionState = Record<string, SegmentoExp>;

const EXPLORACION_INICIAL: ExploracionState = Object.fromEntries(
  SEGMENTOS_EXPLORACION.map((s) => [s.key, { nl: null, nota: "" }])
);

type BinocularidadState = {
  cover_lejos: string; cover_40cm: string; cover_20cm: string;
  hirshberg: string; ojo_dominante: string; ojo_fijador: string;
  ducciones_od: string; ducciones_oi: string; versiones: string;
};

type ProcesoRefractivoState = {
  retino_od_esfera: string; retino_od_cilindro: string; retino_od_eje: string;
  retino_oi_esfera: string; retino_oi_cilindro: string; retino_oi_eje: string;
  av_od_sc_cerca: string; av_oi_sc_cerca: string;
  av_od_cc_cerca: string; av_oi_cc_cerca: string;
  pinhole_od: string; pinhole_oi: string;
  prueba_subjetiva: string; prueba_ambulatoria: string; tolera_prescripcion: string;
};

export default function ExamenFormClient({
  buscarPacientes = async () => [],
  defaultPaciente,
  optometristas = [],
  campanaId,
  examenInicial,
  pacienteInicial,
  optometristasDisponibles = [],
}: Props) {
  const isEditMode = Boolean(examenInicial);
  const defaultPacienteId = pacienteInicial?.id || defaultPaciente?.id;

  // Inicializar refracción desde examen
  const initFields = (): RefraccionFields => {
    if (!examenInicial) return EMPTY;
    return {
      ra_od_esfera: examenInicial.ra_od_esfera?.toString() ?? "",
      ra_od_cilindro: examenInicial.ra_od_cilindro?.toString() ?? "",
      ra_od_eje: examenInicial.ra_od_eje?.toString() ?? "",
      ra_od_adicion: examenInicial.ra_od_adicion?.toString() ?? "",
      ra_oi_esfera: examenInicial.ra_oi_esfera?.toString() ?? "",
      ra_oi_cilindro: examenInicial.ra_oi_cilindro?.toString() ?? "",
      ra_oi_eje: examenInicial.ra_oi_eje?.toString() ?? "",
      ra_oi_adicion: examenInicial.ra_oi_adicion?.toString() ?? "",
      rf_od_esfera: examenInicial.rf_od_esfera?.toString() ?? "",
      rf_od_cilindro: examenInicial.rf_od_cilindro?.toString() ?? "",
      rf_od_eje: examenInicial.rf_od_eje?.toString() ?? "",
      rf_od_adicion: examenInicial.rf_od_adicion?.toString() ?? "",
      rf_oi_esfera: examenInicial.rf_oi_esfera?.toString() ?? "",
      rf_oi_cilindro: examenInicial.rf_oi_cilindro?.toString() ?? "",
      rf_oi_eje: examenInicial.rf_oi_eje?.toString() ?? "",
      rf_oi_adicion: examenInicial.rf_oi_adicion?.toString() ?? "",
    };
  };

  const initExploracion = (): ExploracionState => {
    if (!examenInicial?.exploracion_externa) return EXPLORACION_INICIAL;
    const data = examenInicial.exploracion_externa as Record<string, any>;
    return Object.fromEntries(
      SEGMENTOS_EXPLORACION.map((s) => [
        s.key,
        { nl: data[s.key]?.nl ?? null, nota: data[s.key]?.nota ?? "" },
      ])
    );
  };

  const initBino = (): BinocularidadState => {
    if (!examenInicial?.binocularidad) {
      return {
        cover_lejos: "",
        cover_40cm: "",
        cover_20cm: "",
        hirshberg: "",
        ojo_dominante: "",
        ojo_fijador: "",
        ducciones_od: "",
        ducciones_oi: "",
        versiones: "",
      };
    }
    const data = examenInicial.binocularidad as Record<string, any>;
    return {
      cover_lejos: data.cover_lejos ?? "",
      cover_40cm: data.cover_40cm ?? "",
      cover_20cm: data.cover_20cm ?? "",
      hirshberg: data.hirshberg ?? "",
      ojo_dominante: data.ojo_dominante ?? "",
      ojo_fijador: data.ojo_fijador ?? "",
      ducciones_od: data.ducciones_od ?? "",
      ducciones_oi: data.ducciones_oi ?? "",
      versiones: data.versiones ?? "",
    };
  };

  const initProceso = (): ProcesoRefractivoState => {
    if (!examenInicial?.proceso_refractivo) {
      return {
        retino_od_esfera: "",
        retino_od_cilindro: "",
        retino_od_eje: "",
        retino_oi_esfera: "",
        retino_oi_cilindro: "",
        retino_oi_eje: "",
        av_od_sc_cerca: "",
        av_oi_sc_cerca: "",
        av_od_cc_cerca: "",
        av_oi_cc_cerca: "",
        pinhole_od: "",
        pinhole_oi: "",
        prueba_subjetiva: "",
        prueba_ambulatoria: "",
        tolera_prescripcion: "",
      };
    }
    const data = examenInicial.proceso_refractivo as Record<string, any>;
    return {
      retino_od_esfera: data.retino_od_esfera ?? "",
      retino_od_cilindro: data.retino_od_cilindro ?? "",
      retino_od_eje: data.retino_od_eje ?? "",
      retino_oi_esfera: data.retino_oi_esfera ?? "",
      retino_oi_cilindro: data.retino_oi_cilindro ?? "",
      retino_oi_eje: data.retino_oi_eje ?? "",
      av_od_sc_cerca: data.av_od_sc_cerca ?? "",
      av_oi_sc_cerca: data.av_oi_sc_cerca ?? "",
      av_od_cc_cerca: data.av_od_cc_cerca ?? "",
      av_oi_cc_cerca: data.av_oi_cc_cerca ?? "",
      pinhole_od: data.pinhole_od ?? "",
      pinhole_oi: data.pinhole_oi ?? "",
      prueba_subjetiva: data.prueba_subjetiva ?? "",
      prueba_ambulatoria: data.prueba_ambulatoria ?? "",
      tolera_prescripcion: data.tolera_prescripcion ?? "",
    };
  };

  const initAnamnesis = () => {
    if (!examenInicial?.anamnesis_ext) {
      return { sintomas: [], medicamentos: "", fuma: false, cigarrillos: "", alcohol: false, hxFamiliar: { diabetes: false, glaucoma: false, lentes: false, estrabismo: false } };
    }
    const data = examenInicial.anamnesis_ext as Record<string, any>;
    return {
      sintomas: data.sintomas ?? [],
      medicamentos: data.medicamentos ?? "",
      fuma: data.fuma ?? false,
      cigarrillos: data.cigarrillos_dia?.toString() ?? "",
      alcohol: data.consume_alcohol ?? false,
      hxFamiliar: data.hx_familiar ?? { diabetes: false, glaucoma: false, lentes: false, estrabismo: false },
    };
  };

  const [pacienteId, setPacienteId] = useState(pacienteInicial?.id || defaultPaciente?.id || "");
  const [fields, setFields] = useState<RefraccionFields>(initFields());
  const [plano, setPlano] = useState({ ra_od: false, ra_oi: false, rf_od: false, rf_oi: false });
  const [optometristaNombre, setOptometristaNombre] = useState(examenInicial?.optometrista_nombre ?? optometristasDisponibles[0] ?? optometristas[0]?.nombre ?? "");
  const [lente_uso, setLenteUso] = useState(examenInicial?.lente_uso ?? "");
  const [av_od, setAvOd] = useState(examenInicial?.av_od_sin_lentes ?? "");
  const [av_oi, setAvOi] = useState(examenInicial?.av_oi_sin_lentes ?? "");
  const [av_od_cc, setAvOdCc] = useState(examenInicial?.av_od_cc ?? "");
  const [av_oi_cc, setAvOiCc] = useState(examenInicial?.av_oi_cc ?? "");
  const [pio_od, setPioOd] = useState(examenInicial?.pio_od?.toString() ?? "");
  const [pio_oi, setPioOi] = useState(examenInicial?.pio_oi?.toString() ?? "");
  const [dp, setDp] = useState(examenInicial?.dp?.toString() ?? "");
  const [dp_oi, setDpOi] = useState(examenInicial?.dp_oi?.toString() ?? "");
  const [dp_unico, setDpUnico] = useState(examenInicial?.dp_unico ?? "");
  const [altura, setAltura] = useState(examenInicial?.altura?.toString() ?? "");
  const [motivo_consulta, setMotivoConsulta] = useState(examenInicial?.motivo_consulta ?? "");
  const [observaciones, setObservaciones] = useState(examenInicial?.observaciones ?? "");
  const [lente_material, setLenteMaterial] = useState(examenInicial?.lente_material ?? "");
  const [lente_color, setLenteColor] = useState(examenInicial?.lente_color ?? "");
  const [plan_educacional, setPlanEducacional] = useState(examenInicial?.plan_educacional ?? "");
  const [control_proxima, setControlProxima] = useState(examenInicial?.control_proxima ?? "");
  const [isPending, startTransition] = useTransition();
  const [importMsg, setImportMsg] = useState("");

  const [showAVPIO, setShowAVPIO] = useState(false);
  const [openAnamnesis, setOpenAnamnesis] = useState(false);
  const [openExploracion, setOpenExploracion] = useState(false);
  const [openBinocularidad, setOpenBinocularidad] = useState(false);
  const [openProceso, setOpenProceso] = useState(false);

  const ana = initAnamnesis();
  const [sintomas, setSintomas] = useState<string[]>(ana.sintomas);
  const [medicamentos, setMedicamentos] = useState(ana.medicamentos);
  const [fuma, setFuma] = useState(ana.fuma);
  const [cigarrillos, setCigarrillos] = useState(ana.cigarrillos);
  const [alcohol, setAlcohol] = useState(ana.alcohol);
  const [hxFamiliar, setHxFamiliar] = useState(ana.hxFamiliar);

  const [exploracion, setExploracion] = useState<ExploracionState>(initExploracion());
  const [bino, setBino] = useState<BinocularidadState>(initBino());
  const [proceso, setProceso] = useState<ProcesoRefractivoState>(initProceso());

  const [searchPatient, setSearchPatient] = useState(pacienteInicial?.nombre || defaultPaciente?.nombre || "");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pacientesResult, setPacientesResult] = useState<{ id: string; nombre: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchPatient), 300);
    return () => clearTimeout(t);
  }, [searchPatient]);

  useEffect(() => {
    if (!debouncedSearch.trim() || pacienteId) { setPacientesResult([]); return; }
    setIsSearching(true);
    startTransition(async () => {
      const results = await buscarPacientes(debouncedSearch);
      setPacientesResult(results);
      setIsSearching(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const updateField = (key: keyof RefraccionFields, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const togglePlano = (ojoKey: "ra_od" | "ra_oi" | "rf_od" | "rf_oi") => {
    const next = !plano[ojoKey];
    setPlano((prev) => ({ ...prev, [ojoKey]: next }));
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
    if (defaultPacienteId && !isEditMode) doImport(defaultPacienteId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Serializar módulos a JSON para envío ──
  const buildAnamnesisJson = () => {
    const hasData = sintomas.length > 0 || medicamentos.trim() || fuma || alcohol ||
      Object.values(hxFamiliar).some(Boolean);
    if (!hasData) return "";
    return JSON.stringify({ sintomas, medicamentos: medicamentos.trim() || null, fuma, cigarrillos_dia: fuma && cigarrillos ? parseInt(cigarrillos) : null, consume_alcohol: alcohol, hx_familiar: hxFamiliar });
  };

  const buildExploracionJson = () => {
    const hasData = Object.values(exploracion).some((s) => s.nl !== null || s.nota.trim());
    if (!hasData) return "";
    return JSON.stringify(exploracion);
  };

  const buildBinoJson = () => {
    const hasData = Object.values(bino).some((v) => v.trim());
    if (!hasData) return "";
    return JSON.stringify(bino);
  };

  const buildProcesoJson = () => {
    const hasData = Object.values(proceso).some((v) => v.trim());
    if (!hasData) return "";
    return JSON.stringify(proceso);
  };

  const inputCls = "w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-base sm:text-sm";
  const inputMonoCls = `${inputCls} text-center font-mono`;

  return (
    <form className="space-y-6">
      {/* Campos ocultos */}
      {isEditMode && <input type="hidden" name="examen_id" value={examenInicial?.id} />}
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <input type="hidden" name="optometrista_nombre" value={optometristaNombre} />
      {campanaId && <input type="hidden" name="campana_id" value={campanaId} />}
      <input type="hidden" id="crear_venta_flag" name="crear_venta" value="" />

      {/* Inputs ocultos para módulos opcionales (se llenan antes de submit) */}
      <input type="hidden" name="anamnesis_ext" id="anamnesis_ext_input" />
      <input type="hidden" name="exploracion_externa" id="exploracion_externa_input" />
      <input type="hidden" name="binocularidad" id="binocularidad_input" />
      <input type="hidden" name="proceso_refractivo" id="proceso_refractivo_input" />

      {/* ── Paciente ── */}
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <label className="block text-sm font-medium text-t-secondary mb-1.5">Paciente *</label>
        <div className="relative">
          <input
            type="search"
            placeholder={isSearching ? "Buscando..." : "Escribe el nombre del paciente..."}
            value={searchPatient}
            aria-label="Buscar paciente"
            aria-autocomplete="list"
            aria-expanded={showDropdown && pacientesResult.length > 0}
            onChange={(e) => { setSearchPatient(e.target.value); setShowDropdown(true); setActiveIndex(-1); setPacienteId(""); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => { setShowDropdown(false); setActiveIndex(-1); }, 200)}
            onKeyDown={(e) => {
              if (!showDropdown || pacientesResult.length === 0) return;
              if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, pacientesResult.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
              else if (e.key === "Enter" && activeIndex >= 0) {
                e.preventDefault();
                const p = pacientesResult[activeIndex];
                setPacienteId(p.id); setSearchPatient(p.nombre); setShowDropdown(false); setActiveIndex(-1); setImportMsg("");
                doImport(p.id);
              } else if (e.key === "Escape") { setShowDropdown(false); setActiveIndex(-1); }
            }}
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          {showDropdown && pacientesResult.length > 0 && (
            <div ref={dropdownRef} role="listbox" className="absolute z-20 w-full mt-1 bg-sidebar border border-b-default rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.25)] max-h-60 overflow-y-auto">
              {pacientesResult.map((p, idx) => (
                <div key={p.id} role="option" aria-selected={idx === activeIndex}
                  className={`px-4 py-2.5 cursor-pointer text-t-primary text-sm transition-colors ${idx === activeIndex ? "bg-blue-600 text-white" : "hover:bg-input"}`}
                  onMouseDown={(e) => { e.preventDefault(); setPacienteId(p.id); setSearchPatient(p.nombre); setShowDropdown(false); setActiveIndex(-1); setImportMsg(""); doImport(p.id); }}>
                  {p.nombre}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Optometrista ── */}
      {optometristas.length > 0 && (
        <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
          <label className="block text-sm font-medium text-t-secondary mb-1.5">Optometrista</label>
          <div className="flex flex-wrap gap-2">
            {optometristas.filter((o) => o.activo).map((o) => (
              <button key={o.id} type="button" onClick={() => setOptometristaNombre(o.nombre)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${optometristaNombre === o.nombre ? "bg-blue-600 text-white border-blue-600" : "bg-card border-b-default text-t-secondary hover:text-t-primary"}`}>
                {o.nombre}
              </button>
            ))}
          </div>
          {optometristaNombre && <p className="text-xs text-t-muted mt-2">Firmando como: <span className="font-medium text-t-primary">{optometristaNombre}</span></p>}
        </div>
      )}

      {/* ── Datos del Examen (base) ── */}
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold text-t-primary mb-4">Datos del Examen</h2>

        <div className="mb-4">
          <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Motivo de Consulta</label>
          <input name="motivo_consulta" value={motivo_consulta} onChange={(e) => setMotivoConsulta(e.target.value)}
            type="text" className={inputCls} placeholder="" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Lente - Uso</label>
            <select name="lente_uso" value={lente_uso} onChange={(e) => setLenteUso(e.target.value)} className={inputCls}>
              <option value="">Seleccionar...</option>
              {LENTE_USO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* AV y PIO ocultos por defecto */}
          {showAVPIO && (
            <>
              <div>
                <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">AV OD <span className="normal-case text-t-blue">(sin lentes)</span></label>
                <input name="av_od_sin_lentes" value={av_od} onChange={(e) => setAvOd(e.target.value)} type="text" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">AV OI <span className="normal-case text-t-purple">(sin lentes)</span></label>
                <input name="av_oi_sin_lentes" value={av_oi} onChange={(e) => setAvOi(e.target.value)} type="text" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">AV OD <span className="normal-case text-t-blue">(con corrección)</span></label>
                <input name="av_od_cc" value={av_od_cc} onChange={(e) => setAvOdCc(e.target.value)} type="text" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">AV OI <span className="normal-case text-t-purple">(con corrección)</span></label>
                <input name="av_oi_cc" value={av_oi_cc} onChange={(e) => setAvOiCc(e.target.value)} type="text" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">PIO <span className="normal-case text-t-blue font-semibold">OD</span> (mmHg)</label>
                <input name="pio_od" value={pio_od} onChange={(e) => setPioOd(e.target.value)} type="text" inputMode="decimal" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">PIO <span className="normal-case text-t-purple font-semibold">OI</span> (mmHg)</label>
                <input name="pio_oi" value={pio_oi} onChange={(e) => setPioOi(e.target.value)} type="text" inputMode="decimal" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">DP <span className="normal-case text-t-blue font-semibold">OD</span> (mm)</label>
                <input name="dp" value={dp} onChange={(e) => setDp(e.target.value)} type="number" step="0.5" className={inputCls + " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"} />
              </div>
              <div>
                <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">DP <span className="normal-case text-t-purple font-semibold">OI</span> (mm)</label>
                <input name="dp_oi" value={dp_oi} onChange={(e) => setDpOi(e.target.value)} type="number" step="0.5" className={inputCls + " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"} />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">DP <span className="normal-case text-t-muted font-normal">único</span></label>
            <input name="dp_unico" value={dp_unico} onChange={(e) => setDpUnico(e.target.value)} type="text" className={inputCls} placeholder="" />
          </div>
          <div>
            <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Altura (mm)</label>
            <input name="altura" value={altura} onChange={(e) => setAltura(e.target.value)} type="number" step="0.5" className={inputCls + " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"} placeholder="" />
          </div>
        </div>

        {/* Botón toggle para AV y PIO */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowAVPIO(!showAVPIO)}
            className="text-sm font-medium text-blue-600 hover:text-blue-500 transition"
          >
            {showAVPIO ? "✕ Ocultar campos adicionales (AV, PIO, DP OD/OI)" : "+ Agregar campos adicionales (AV, PIO, DP OD/OI)"}
          </button>
        </div>
      </div>

      {/* ── RA ── */}
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-t-primary">Refracción Actual (RA)</h2>
            <p className="text-xs text-t-muted mt-0.5">Graduación que el paciente lleva actualmente</p>
          </div>
          {!isEditMode && (
            <button type="button" onClick={handleImport} disabled={isPending}
              className="px-3 py-2.5 min-h-11 text-xs font-medium bg-a-amber-bg text-t-amber border border-a-amber-border rounded-lg hover:opacity-80 transition disabled:opacity-50">
              {isPending ? "Importando..." : "📋 Importar última RF"}
            </button>
          )}
        </div>
        {importMsg && <p className={`text-xs mb-3 ${importMsg.startsWith("✓") ? "text-t-green" : "text-t-amber"}`}>{importMsg}</p>}
        <RefraccionGrid prefix="ra" fields={fields} onChange={updateField} plano={plano} onTogglePlano={togglePlano} />
      </div>

      {/* ── RF ── */}
      <div className="p-6 bg-a-blue-bg border border-[var(--accent-blue)] rounded-2xl">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-t-primary">Refracción Final (RF)</h2>
          <p className="text-xs text-t-muted mt-0.5">Nueva graduación prescrita en este examen</p>
        </div>
        <RefraccionGrid prefix="rf" fields={fields} onChange={updateField} plano={plano} onTogglePlano={togglePlano} />
      </div>

      {/* ── Observaciones ── */}
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <label className="block text-sm font-medium text-t-secondary mb-1.5">Observaciones</label>
        <textarea name="observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
          rows={3} placeholder=""
          className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none text-base sm:text-sm" />
      </div>

      {/* ══════════════════════════════════════════════════════
          MÓDULOS OPCIONALES - TOGGLE
          ══════════════════════════════════════════════════ */}
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <button
          type="button"
          onClick={() => {
            const anyOpen = openAnamnesis || openExploracion || openBinocularidad || openProceso;
            setOpenAnamnesis(!anyOpen);
            setOpenExploracion(false);
            setOpenBinocularidad(false);
            setOpenProceso(false);
          }}
          className="w-full text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-t-primary">Módulos clínicos opcionales</h2>
              <p className="text-xs text-t-muted mt-0.5">Anamnesis, exploración, binocularidad, proceso refractivo completo</p>
            </div>
            <span className="text-2xl text-t-secondary">{(openAnamnesis || openExploracion || openBinocularidad || openProceso) ? "▼" : "▶"}</span>
          </div>
        </button>
      </div>

      {/* Mostrar módulos solo si al menos uno está abierto O hay datos */}
      {(openAnamnesis || openExploracion || openBinocularidad || openProceso || sintomas.length > 0 || medicamentos.trim() || fuma || alcohol || Object.values(hxFamiliar).some(Boolean) || Object.values(exploracion).some((s) => s.nl !== null || s.nota.trim()) || Object.values(bino).some((v) => v.trim()) || Object.values(proceso).some((v) => v.trim())) && (
      <div className="space-y-3">

        {/* ── Módulo 1: Anamnesis Clínica ── */}
        <ModuloOpcional
          titulo="Anamnesis Clínica"
          descripcion="Síntomas del día, antecedentes sistémicos, historia familiar"
          icono="📋"
          abierto={openAnamnesis}
          onToggle={() => setOpenAnamnesis(!openAnamnesis)}
          activo={sintomas.length > 0 || medicamentos.trim().length > 0 || fuma || alcohol || Object.values(hxFamiliar).some(Boolean)}
        >
          <div className="space-y-5">
            {/* Síntomas */}
            <div>
              <p className="text-xs font-medium text-t-muted uppercase tracking-wider mb-2">Síntomas presentes hoy</p>
              <div className="flex flex-wrap gap-2">
                {SINTOMAS_OPCIONES.map((s) => (
                  <button key={s} type="button"
                    onClick={() => setSintomas((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])}
                    className={`px-3 py-2 min-h-[36px] text-xs rounded-full border transition font-medium ${sintomas.includes(s) ? "bg-blue-600 text-white border-blue-600" : "bg-input border-b-default text-t-secondary hover:text-t-primary"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Medicamentos */}
            <div>
              <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Medicamentos actuales</label>
              <input type="text" value={medicamentos} onChange={(e) => setMedicamentos(e.target.value)}
                placeholder="Ej: Metformina 500mg, Losartán 50mg..." className={inputCls} />
            </div>

            {/* Hábitos */}
            <div>
              <p className="text-xs font-medium text-t-muted uppercase tracking-wider mb-2">Hábitos</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={fuma} onChange={(e) => setFuma(e.target.checked)}
                    className="w-4 h-4 rounded border-b-default bg-input text-blue-600" />
                  <span className="text-sm text-t-secondary">Fuma</span>
                </label>
                {fuma && (
                  <input type="number" value={cigarrillos} onChange={(e) => setCigarrillos(e.target.value)}
                    placeholder="Cigarrillos/día" min={1} max={100}
                    className="w-36 px-3 py-1 text-sm bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={alcohol} onChange={(e) => setAlcohol(e.target.checked)}
                    className="w-4 h-4 rounded border-b-default bg-input text-blue-600" />
                  <span className="text-sm text-t-secondary">Consume alcohol</span>
                </label>
              </div>
            </div>

            {/* Historia familiar */}
            <div>
              <p className="text-xs font-medium text-t-muted uppercase tracking-wider mb-2">Historia familiar</p>
              <div className="flex flex-wrap gap-4">
                {([
                  { key: "diabetes", label: "Diabetes" },
                  { key: "glaucoma", label: "Glaucoma" },
                  { key: "lentes", label: "Usan lentes" },
                  { key: "estrabismo", label: "Ojos desviados" },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hxFamiliar[key]}
                      onChange={(e) => setHxFamiliar((prev: typeof hxFamiliar) => ({ ...prev, [key]: e.target.checked }))}
                      className="w-4 h-4 rounded border-b-default bg-input text-blue-600" />
                    <span className="text-sm text-t-secondary">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </ModuloOpcional>

        {/* ── Módulo 2: Exploración Ocular Externa ── */}
        <ModuloOpcional
          titulo="Exploración Ocular Externa"
          descripcion="Evaluación de segmentos: párpados, córnea, cristalino, movimientos..."
          icono="👁"
          abierto={openExploracion}
          onToggle={() => setOpenExploracion(!openExploracion)}
          activo={Object.values(exploracion).some((s) => s.nl !== null || s.nota.trim().length > 0)}
        >
          <div className="space-y-2">
            <p className="text-xs text-t-muted mb-3">Marcar NL (Normal) o ANL (Anormal) por segmento. Dejar en blanco si no fue evaluado.</p>
            {SEGMENTOS_EXPLORACION.map(({ key, label }) => {
              const seg = exploracion[key];
              return (
                <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 border-b border-b-default last:border-0">
                  <span className="text-sm text-t-secondary w-36 shrink-0">{label}</span>
                  <div className="flex items-center gap-2">
                    <button type="button"
                      onClick={() => setExploracion((prev) => ({ ...prev, [key]: { ...prev[key], nl: prev[key].nl === true ? null : true } }))}
                      className={`px-3 py-2 min-h-[36px] text-xs font-semibold rounded-lg border transition ${seg.nl === true ? "bg-emerald-600 text-white border-emerald-600" : "bg-input border-b-default text-t-muted hover:text-t-primary"}`}>
                      NL
                    </button>
                    <button type="button"
                      onClick={() => setExploracion((prev) => ({ ...prev, [key]: { ...prev[key], nl: prev[key].nl === false ? null : false } }))}
                      className={`px-3 py-2 min-h-[36px] text-xs font-semibold rounded-lg border transition ${seg.nl === false ? "bg-red-500 text-white border-red-500" : "bg-input border-b-default text-t-muted hover:text-t-primary"}`}>
                      ANL
                    </button>
                    {(seg.nl === false || seg.nota) && (
                      <input type="text" value={seg.nota}
                        onChange={(e) => setExploracion((prev) => ({ ...prev, [key]: { ...prev[key], nota: e.target.value } }))}
                        placeholder="Describir hallazgo..."
                        className="flex-1 px-3 py-1 text-sm bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ModuloOpcional>

        {/* ── Módulo 3: Binocularidad ── */}
        <ModuloOpcional
          titulo="Binocularidad y Motilidad"
          descripcion="Cover test, Hirshberg, ducciones, ojo dominante..."
          icono="🔀"
          abierto={openBinocularidad}
          onToggle={() => setOpenBinocularidad(!openBinocularidad)}
          activo={Object.values(bino).some((v) => v.trim().length > 0)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { key: "cover_lejos", label: "Cover Test — Lejos", placeholder: "Ej: Orto, Exoforia 4Δ" },
              { key: "cover_40cm",  label: "Cover Test — 40 cm",  placeholder: "Ej: Exoforia 6Δ" },
              { key: "cover_20cm",  label: "Cover Test — 20 cm",  placeholder: "Ej: Orto" },
              { key: "hirshberg",   label: "Test de Hirshberg",   placeholder: "Ej: Reflejos centrados" },
              { key: "ducciones_od", label: "Ducciones OD",       placeholder: "Ej: Completas" },
              { key: "ducciones_oi", label: "Ducciones OI",       placeholder: "Ej: Completas" },
              { key: "versiones",    label: "Versiones",           placeholder: "Ej: Normales" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">{label}</label>
                <input type="text" value={bino[key as keyof BinocularidadState]}
                  onChange={(e) => setBino((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder} className={inputCls} />
              </div>
            ))}
            {/* Ojo dominante */}
            <div>
              <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Ojo Dominante</label>
              <div className="flex gap-2">
                {["OD", "OI"].map((o) => (
                  <button key={o} type="button"
                    onClick={() => setBino((prev) => ({ ...prev, ojo_dominante: prev.ojo_dominante === o ? "" : o }))}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition ${bino.ojo_dominante === o ? "bg-blue-600 text-white border-blue-600" : "bg-input border-b-default text-t-secondary hover:text-t-primary"}`}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
            {/* Ojo fijador */}
            <div>
              <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Ojo Fijador</label>
              <div className="flex gap-2">
                {["OD", "OI"].map((o) => (
                  <button key={o} type="button"
                    onClick={() => setBino((prev) => ({ ...prev, ojo_fijador: prev.ojo_fijador === o ? "" : o }))}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition ${bino.ojo_fijador === o ? "bg-blue-600 text-white border-blue-600" : "bg-input border-b-default text-t-secondary hover:text-t-primary"}`}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ModuloOpcional>

        {/* ── Módulo 4: Proceso Refractivo Completo ── */}
        <ModuloOpcional
          titulo="Proceso Refractivo Completo"
          descripcion="Retinoscopía objetiva, AV cerca, pinhole, prueba subjetiva, tolerancia"
          icono="🔭"
          abierto={openProceso}
          onToggle={() => setOpenProceso(!openProceso)}
          activo={Object.values(proceso).some((v) => v.trim().length > 0)}
        >
          <div className="space-y-5">
            {/* Retinoscopía */}
            <div>
              <p className="text-xs font-medium text-t-muted uppercase tracking-wider mb-2">Retinoscopía Estática (objetiva)</p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left py-2 pr-3 text-xs font-medium text-t-muted uppercase w-12">Ojo</th>
                      <th className="text-center py-2 px-1 text-xs font-medium text-t-muted uppercase">Esfera</th>
                      <th className="text-center py-2 px-1 text-xs font-medium text-t-muted uppercase">Cilindro</th>
                      <th className="text-center py-2 px-1 text-xs font-medium text-t-muted uppercase">Eje (°)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["od", "oi"] as const).map((ojo) => (
                      <tr key={ojo}>
                        <td className="py-1 pr-3">
                          <span className={`text-sm font-bold ${ojo === "od" ? "text-t-blue" : "text-t-purple"}`}>{ojo.toUpperCase()}</span>
                        </td>
                        {(["esfera", "cilindro", "eje"] as const).map((campo) => {
                          const k = `retino_${ojo}_${campo}` as keyof ProcesoRefractivoState;
                          return (
                            <td key={campo} className="py-1 px-1">
                              <input type="text" inputMode="decimal" value={proceso[k]}
                                onChange={(e) => setProceso((prev) => ({ ...prev, [k]: e.target.value }))}
                                placeholder={campo === "eje" ? "0-180" : "±0.00"}
                                className={inputMonoCls} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AV cerca + Pinhole */}
            <div>
              <p className="text-xs font-medium text-t-muted uppercase tracking-wider mb-2">Agudeza Visual — Cerca y Pinhole</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { key: "av_od_sc_cerca", label: "AV OD SC Cerca", color: "text-t-blue" },
                  { key: "av_oi_sc_cerca", label: "AV OI SC Cerca", color: "text-t-purple" },
                  { key: "av_od_cc_cerca", label: "AV OD CC Cerca", color: "text-t-blue" },
                  { key: "av_oi_cc_cerca", label: "AV OI CC Cerca", color: "text-t-purple" },
                  { key: "pinhole_od",     label: "Pinhole OD",     color: "text-t-blue" },
                  { key: "pinhole_oi",     label: "Pinhole OI",     color: "text-t-purple" },
                ].map(({ key, label, color }) => (
                  <div key={key}>
                    <label className={`block text-xs font-medium uppercase tracking-wider mb-1.5 ${color}`}>{label}</label>
                    <input type="text" value={proceso[key as keyof ProcesoRefractivoState]}
                      onChange={(e) => setProceso((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder="Ej: 20/20" className={inputCls} />
                  </div>
                ))}
              </div>
            </div>

            {/* Prueba subjetiva */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Prueba Subjetiva Utilizada</label>
                <select value={proceso.prueba_subjetiva}
                  onChange={(e) => setProceso((prev) => ({ ...prev, prueba_subjetiva: e.target.value }))}
                  className={inputCls}>
                  <option value="">Seleccionar...</option>
                  {["CCJ", "Dial astigmático", "Emborronamiento", "Test duocromo", "Test nublado/claro"].map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Prueba Ambulatoria</label>
                <input type="text" value={proceso.prueba_ambulatoria}
                  onChange={(e) => setProceso((prev) => ({ ...prev, prueba_ambulatoria: e.target.value }))}
                  placeholder="Ej: Tolera bien, adaptación en proceso..." className={inputCls} />
              </div>
            </div>

            {/* Tolerancia */}
            <div>
              <p className="text-xs font-medium text-t-muted uppercase tracking-wider mb-2">¿Tolera la prescripción?</p>
              <div className="flex gap-2">
                {[{ v: "si", label: "Sí" }, { v: "no", label: "No" }].map(({ v, label }) => (
                  <button key={v} type="button"
                    onClick={() => setProceso((prev) => ({ ...prev, tolera_prescripcion: prev.tolera_prescripcion === v ? "" : v }))}
                    className={`px-6 py-2 text-sm font-semibold rounded-lg border transition ${proceso.tolera_prescripcion === v ? (v === "si" ? "bg-emerald-600 text-white border-emerald-600" : "bg-red-500 text-white border-red-500") : "bg-input border-b-default text-t-secondary hover:text-t-primary"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ModuloOpcional>
      </div>
      )}

      {/* ── Plan y Recomendaciones de Lente (dentro de módulos opcionales) ── */}
      {(openAnamnesis || openExploracion || openBinocularidad || openProceso || sintomas.length > 0 || medicamentos.trim() || fuma || alcohol || Object.values(hxFamiliar).some(Boolean) || Object.values(exploracion).some((s) => s.nl !== null || s.nota.trim()) || Object.values(bino).some((v) => v.trim()) || Object.values(proceso).some((v) => v.trim()) || lente_material || lente_color || plan_educacional || control_proxima) && (
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold text-t-primary mb-4">Plan y Recomendaciones</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Material de lente</label>
            <select name="lente_material" value={lente_material} onChange={(e) => setLenteMaterial(e.target.value)} className={inputCls}>
              <option value="">Seleccionar...</option>
              {LENTE_MATERIAL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Color / tinte</label>
            <select name="lente_color" value={lente_color} onChange={(e) => setLenteColor(e.target.value)} className={inputCls}>
              <option value="">Seleccionar...</option>
              {LENTE_COLOR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Próximo control</label>
            <input name="control_proxima" value={control_proxima} onChange={(e) => setControlProxima(e.target.value)}
              placeholder="Ej: 6 meses, 1 año" type="text" className={inputCls} />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-t-muted uppercase tracking-wider mb-1.5">Plan educacional / recomendaciones</label>
          <textarea name="plan_educacional" value={plan_educacional} onChange={(e) => setPlanEducacional(e.target.value)}
            rows={2} placeholder="Indicaciones para el paciente, cuidado de lentes, próximos pasos..."
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none text-base sm:text-sm" />
        </div>
      </div>
      )}

      {/* ── Acciones ── */}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          formAction={isEditMode ? actualizarExamen : crearExamen}
          disabled={isPending}
          onClick={() => {
            (document.getElementById("anamnesis_ext_input") as HTMLInputElement).value = buildAnamnesisJson();
            (document.getElementById("exploracion_externa_input") as HTMLInputElement).value = buildExploracionJson();
            (document.getElementById("binocularidad_input") as HTMLInputElement).value = buildBinoJson();
            (document.getElementById("proceso_refractivo_input") as HTMLInputElement).value = buildProcesoJson();
          }}
          className="px-6 py-2.5 min-h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed">
          {isPending ? (isEditMode ? "Actualizando..." : "Guardando...") : (isEditMode ? "Actualizar examen" : "Guardar examen")}
        </button>
        {!isEditMode && (
          <button
            type="submit"
            disabled={isPending}
            onClick={() => {
              const flag = document.getElementById("crear_venta_flag") as HTMLInputElement;
              if (flag) flag.value = "1";
              (document.getElementById("anamnesis_ext_input") as HTMLInputElement).value = buildAnamnesisJson();
              (document.getElementById("exploracion_externa_input") as HTMLInputElement).value = buildExploracionJson();
              (document.getElementById("binocularidad_input") as HTMLInputElement).value = buildBinoJson();
              (document.getElementById("proceso_refractivo_input") as HTMLInputElement).value = buildProcesoJson();
            }}
            formAction={crearExamen}
            className="px-6 py-2.5 min-h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-emerald-600/25 disabled:opacity-50 disabled:cursor-not-allowed">
            {isPending ? "Guardando..." : "Guardar y crear venta →"}
          </button>
        )}
        <a href={isEditMode ? `/dashboard/pacientes/${pacienteId}` : "/dashboard/examenes"}
          className="px-6 py-2.5 min-h-11 bg-card border border-b-default text-t-secondary hover:text-t-primary rounded-lg transition-colors inline-flex items-center">
          Cancelar
        </a>
      </div>
    </form>
  );
}

// ── Wrapper de módulo opcional colapsable ──
function ModuloOpcional({ titulo, descripcion, icono, abierto, onToggle, activo, children }: {
  titulo: string;
  descripcion: string;
  icono: string;
  abierto: boolean;
  onToggle: () => void;
  activo: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border transition-colors ${abierto ? "bg-card border-[var(--accent-blue)] shadow-[var(--shadow-card)]" : "bg-card/50 border-b-default"}`}>
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left">
        <div className="flex items-center gap-3">
          <span className="text-xl">{icono}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-t-primary">{titulo}</span>
              {activo
                ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Completado</span>
                : <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-badge text-t-muted border border-b-default">Opcional</span>
              }
            </div>
            <p className="text-xs text-t-muted mt-0.5">{descripcion}</p>
          </div>
        </div>
        <span className={`text-t-muted transition-transform duration-200 ${abierto ? "rotate-180" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      </button>
      {abierto && (
        <div className="px-5 pb-5 pt-1 border-t border-b-default">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Grid de Refracción (sin cambios) ──
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
    <div className="overflow-x-auto overscroll-x-contain">
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
                            <input type="text" inputMode="decimal" name={fieldKey}
                              value={isPL ? "0" : fields[fieldKey]}
                              onChange={(e) => onChange(fieldKey, e.target.value)}
                              placeholder={isPL ? "PL" : c.placeholder}
                              disabled={isPL}
                              aria-label={`${ojo.toUpperCase()} ${c.label}`}
                              className={`w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary text-center text-base sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${isPL ? "opacity-0 absolute" : ""}`}
                            />
                            {isPL && <div className="w-full px-3 py-2 bg-a-blue-bg border border-[var(--accent-blue)] rounded-lg text-t-blue text-center text-sm font-bold font-mono">PL</div>}
                          </div>
                          <button type="button" onClick={() => onTogglePlano(ojoKey)}
                            className={`text-[10px] font-medium rounded px-1 py-0.5 transition ${isPL ? "bg-a-blue-bg text-t-blue border border-[var(--accent-blue)]" : "bg-badge text-t-muted border border-b-default hover:text-t-primary"}`}>
                            {isPL ? "✓ PL" : "PL"}
                          </button>
                        </div>
                      ) : (
                        <input type="text" inputMode="decimal" name={fieldKey} value={fields[fieldKey]} onChange={(e) => onChange(fieldKey, e.target.value)}
                          placeholder={c.placeholder} aria-label={`${ojo.toUpperCase()} ${c.label}`}
                          className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary text-center text-base sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
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
