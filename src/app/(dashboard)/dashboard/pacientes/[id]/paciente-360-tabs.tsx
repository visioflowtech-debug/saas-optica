"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { obtenerDatosReceta, anularExamen } from "../../examenes/actions";
import { fmtFecha } from "@/lib/date-sv";
import { eliminarExamen } from "../../eliminar-actions";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { generarRecetaPDF } from "../../examenes/receta-pdf";

interface Paciente {
  id: string; nombre: string; telefono: string | null; email: string | null;
  fecha_nacimiento: string | null; profesion: string | null;
  etiquetas_medicas: unknown; acepta_marketing: boolean; created_at: string;
}

interface Examen {
  id: string; fecha_examen: string;
  optometrista: { nombre: string } | { nombre: string }[] | null;
  ra_od_esfera: number | null; ra_od_cilindro: number | null; ra_od_eje: number | null; ra_od_adicion: number | null;
  ra_oi_esfera: number | null; ra_oi_cilindro: number | null; ra_oi_eje: number | null; ra_oi_adicion: number | null;
  rf_od_esfera: number | null; rf_od_cilindro: number | null; rf_od_eje: number | null; rf_od_adicion: number | null;
  rf_oi_esfera: number | null; rf_oi_cilindro: number | null; rf_oi_eje: number | null; rf_oi_adicion: number | null;
  lente_uso: string | null;
  motivo_consulta: string | null;
  av_od_sin_lentes: string | null;
  av_oi_sin_lentes: string | null;
  dp: number | null;
  altura: number | null;
  observaciones: string | null;
  anulado: boolean;
}

interface Orden {
  id: string; created_at: string; tipo: string; estado: string;
  total: number; notas: string | null;
  asesor: { nombre: string } | { nombre: string }[] | null;
}

interface LabEstado { estado: string; laboratorio_externo: string | null; }

interface Props {
  paciente: Paciente; examenes: Examen[]; ordenes: Orden[];
  labEstados: Record<string, LabEstado>; edad: number | null;
}

const TABS = [
  { key: "demograficos", label: "Datos del paciente", icon: "👤" },
  { key: "clinico", label: "Historial clínico", icon: "🔬" },
  { key: "compras", label: "Historial de Ventas", icon: "🛒" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function Paciente360Tabs({ paciente, examenes, ordenes, labEstados, edad }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("demograficos");

  return (
    <>
      <div className="flex gap-1 bg-card p-1 rounded-xl border border-b-default">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.key
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                : "text-t-secondary hover:text-t-primary hover:bg-card-hover"
            }`}>
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        {activeTab === "demograficos" && <TabDemograficos paciente={paciente} edad={edad} />}
        {activeTab === "clinico" && <TabClinico examenes={examenes} />}
        {activeTab === "compras" && <TabCompras ordenes={ordenes} labEstados={labEstados} />}
      </div>
    </>
  );
}

function TabDemograficos({ paciente, edad }: { paciente: Paciente; edad: number | null }) {
  const tags = Array.isArray(paciente.etiquetas_medicas) ? (paciente.etiquetas_medicas as string[]) : [];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <InfoRow label="Nombre" value={paciente.nombre} />
        <InfoRow label="Teléfono" value={paciente.telefono || "—"} />
        <InfoRow label="Email" value={paciente.email || "—"} />
        <InfoRow label="Fecha de nacimiento" value={paciente.fecha_nacimiento ? `${paciente.fecha_nacimiento} (${edad} años)` : "—"} />
        <InfoRow label="Profesión" value={paciente.profesion || "—"} />
      </div>
      <div className="space-y-4">
        <div>
          <span className="text-xs text-t-muted uppercase tracking-wider">Etiquetas médicas</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {tags.length > 0 ? tags.map((tag) => (
              <span key={tag} className="px-3 py-1 text-xs font-medium bg-a-red-bg text-t-red border border-a-red-border rounded-full">{tag}</span>
            )) : <span className="text-sm text-t-muted">Sin etiquetas</span>}
          </div>
        </div>
        <InfoRow label="Acepta marketing" value={
          <span className={paciente.acepta_marketing ? "text-t-green" : "text-t-muted"}>
            {paciente.acepta_marketing ? "✓ Sí" : "✗ No"}
          </span>
        } />
        <InfoRow label="Paciente desde" value={fmtFecha(paciente.created_at, { month: "long" })} />
      </div>
    </div>
  );
}

function TabClinico({ examenes }: { examenes: Examen[] }) {
  const [selectedExamen, setSelectedExamen] = useState<Examen | null>(null);

  if (examenes.length === 0) {
    return <div className="text-center py-12 text-t-muted text-sm">No hay exámenes clínicos registrados para este paciente</div>;
  }
  return (
    <div className="space-y-4">
      {examenes.map((ex, i) => {
        const optNombre = getNestedName(ex.optometrista);
        return (
          <div key={ex.id} className={`p-5 rounded-xl border transition ${ex.anulado ? "bg-card/50 border-red-500/20 opacity-75" : i === 0 ? "bg-a-blue-bg border-[var(--accent-blue)]" : "bg-card border-b-default"}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${ex.anulado ? "text-t-muted line-through" : "text-t-primary"}`}>
                  {fmtFecha(ex.fecha_examen, { month: "long" })}
                </span>
                {ex.anulado && <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-red-500/10 text-red-500 rounded border border-red-500/20">Anulado</span>}
                {!ex.anulado && i === 0 && <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-600 text-white rounded">Más reciente</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-t-muted">{optNombre}</span>
                <button
                  onClick={() => setSelectedExamen(ex)}
                  className="px-2 py-1 text-[10px] font-medium bg-a-blue-bg text-t-blue border border-[var(--accent-blue)] rounded-md hover:opacity-80 transition"
                  title="Ver detalle completo"
                >
                  👁️ Ver
                </button>
                {!ex.anulado && <RecetaPDFButton examenId={ex.id} />}
                {!ex.anulado && <AnularExamenButton examenId={ex.id} />}
                <ConfirmDeleteButton
                  label="🗑"
                  confirmText="¿Eliminar este examen permanentemente? Se desvinculará de cualquier orden asociada. Esta acción no se puede deshacer."
                  onConfirm={() => eliminarExamen(ex.id)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-t-muted text-xs uppercase">
                    <th className="text-left py-1 pr-4">Ojo</th>
                    <th className="text-right py-1 px-3">Esfera</th>
                    <th className="text-right py-1 px-3">Cilindro</th>
                    <th className="text-right py-1 px-3">Eje</th>
                    <th className="text-right py-1 px-3">Adición</th>
                  </tr>
                </thead>
                <tbody className="text-t-secondary">
                  <tr>
                    <td className="py-1 pr-4 font-medium text-t-blue">OD</td>
                    <td className="text-right py-1 px-3">{fmtNum(ex.rf_od_esfera)}</td>
                    <td className="text-right py-1 px-3">{fmtNum(ex.rf_od_cilindro)}</td>
                    <td className="text-right py-1 px-3">{ex.rf_od_eje != null ? `${ex.rf_od_eje}°` : "—"}</td>
                    <td className="text-right py-1 px-3">{fmtNum(ex.rf_od_adicion)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 font-medium text-t-purple">OI</td>
                    <td className="text-right py-1 px-3">{fmtNum(ex.rf_oi_esfera)}</td>
                    <td className="text-right py-1 px-3">{fmtNum(ex.rf_oi_cilindro)}</td>
                    <td className="text-right py-1 px-3">{ex.rf_oi_eje != null ? `${ex.rf_oi_eje}°` : "—"}</td>
                    <td className="text-right py-1 px-3">{fmtNum(ex.rf_oi_adicion)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Extra fields */}
            <div className="flex flex-col gap-4 mt-4 pt-3 border-t border-b-subtle">
              {ex.motivo_consulta && (
                <div>
                  <span className="text-[10px] text-t-muted uppercase tracking-wider">Motivo de consulta</span>
                  <p className="text-sm text-t-primary font-medium">{ex.motivo_consulta}</p>
                </div>
              )}
              
              <div className="flex flex-wrap gap-4">
                {ex.lente_uso && <ExamDetail label="Lente-Uso" value={ex.lente_uso} />}
                {ex.av_od_sin_lentes && <ExamDetail label="AV OD s/l" value={ex.av_od_sin_lentes} />}
                {ex.av_oi_sin_lentes && <ExamDetail label="AV OI s/l" value={ex.av_oi_sin_lentes} />}
                {ex.dp != null && <ExamDetail label="DP" value={`${ex.dp} mm`} />}
                {ex.altura != null && <ExamDetail label="Altura" value={`${ex.altura} mm`} />}
              </div>
            </div>
            {ex.observaciones && (
              <div className="mt-3">
                <span className="text-[10px] text-t-muted uppercase tracking-wider">Observaciones</span>
                <p className="text-sm text-t-secondary italic">📝 {ex.observaciones}</p>
              </div>
            )}
          </div>
        );
      })}

      {selectedExamen && (
        <VerDetalleExamenModal
          examen={selectedExamen}
          onClose={() => setSelectedExamen(null)}
        />
      )}
    </div>
  );
}

function TabCompras({ ordenes, labEstados }: { ordenes: Orden[]; labEstados: Record<string, LabEstado> }) {
  if (ordenes.length === 0) {
    return <div className="text-center py-12 text-t-muted text-sm">No hay compras registradas para este paciente</div>;
  }
  return (
    <div className="space-y-4">
      {ordenes.map((ord) => {
        const lab = labEstados[ord.id];
        return (
          <div key={ord.id} className="p-5 bg-card border border-b-default rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-t-primary font-medium">
                  {fmtFecha(ord.created_at)}
                </span>
                <StatusBadge estado={ord.estado} />
                {lab && <LabBadge estado={lab.estado} lab={lab.laboratorio_externo || ""} />}
              </div>
              <span className="text-lg font-bold text-t-primary">{formatCurrency(Number(ord.total))}</span>
            </div>
            {ord.notas && <p className="mt-2 text-xs text-t-muted">📝 {ord.notas}</p>}
            
            <div className="mt-4 flex justify-end">
              <Link 
                href={`/dashboard/ventas/${ord.id}`}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-input text-t-primary rounded-lg border border-b-default hover:bg-card hover:border-[var(--accent-blue)] transition shadow-sm"
              >
                Ver Detalle de Venta →
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs text-t-muted uppercase tracking-wider">{label}</span>
      <p className="text-t-primary mt-0.5">{value}</p>
    </div>
  );
}

function StatusBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    borrador: "bg-a-slate-bg text-t-slate",
    confirmada: "bg-a-blue-bg text-t-blue",
    facturada: "bg-a-green-bg text-t-green",
    cancelada: "bg-a-red-bg text-t-red",
  };
  return <span className={`px-2 py-0.5 text-[10px] font-medium uppercase rounded-full ${map[estado] || map.borrador}`}>{estado}</span>;
}

function LabBadge({ estado, lab }: { estado: string; lab: string }) {
  const map: Record<string, string> = {
    pendiente: "bg-a-amber-bg text-t-amber",
    en_laboratorio: "bg-a-blue-bg text-t-blue",
    recibido: "bg-a-green-bg text-t-green",
    entregado: "bg-a-green-bg text-t-green",
  };
  const labels: Record<string, string> = {
    pendiente: "Pendiente", en_laboratorio: `En ${lab}`,
    recibido: "Recibido", entregado: "Entregado ✓",
  };
  return <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${map[estado] || ""}`}>{labels[estado] || estado}</span>;
}

interface OjoData { esfera: number | null; cilindro: number | null; eje: number | null; adicion: number | null; }
function RecetaTabla({ od, oi, highlighted }: { od: OjoData; oi: OjoData; highlighted?: boolean }) {
  const cellCls = `text-right py-1.5 px-2 font-mono text-sm ${highlighted ? "text-t-primary" : "text-t-secondary"}`;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-b-subtle">
          <th className="text-left pb-2 text-[10px] font-medium text-t-muted uppercase tracking-wider w-10">OJO</th>
          <th className="text-right pb-2 px-2 text-[10px] font-medium text-t-muted uppercase tracking-wider">Esfera</th>
          <th className="text-right pb-2 px-2 text-[10px] font-medium text-t-muted uppercase tracking-wider">Cilindro</th>
          <th className="text-right pb-2 px-2 text-[10px] font-medium text-t-muted uppercase tracking-wider">Eje</th>
          <th className="text-right pb-2 px-2 text-[10px] font-medium text-t-muted uppercase tracking-wider">Adición</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-b-subtle/50">
          <td className="py-1.5 pr-2 font-bold text-t-blue text-sm">OD</td>
          <td className={cellCls}>{fmtNum(od.esfera)}</td>
          <td className={cellCls}>{fmtNum(od.cilindro)}</td>
          <td className={cellCls}>{od.eje != null ? `${od.eje}°` : "—"}</td>
          <td className={cellCls}>{fmtNum(od.adicion)}</td>
        </tr>
        <tr>
          <td className="py-1.5 pr-2 font-bold text-t-purple text-sm">OI</td>
          <td className={cellCls}>{fmtNum(oi.esfera)}</td>
          <td className={cellCls}>{fmtNum(oi.cilindro)}</td>
          <td className={cellCls}>{oi.eje != null ? `${oi.eje}°` : "—"}</td>
          <td className={cellCls}>{fmtNum(oi.adicion)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function fmtNum(val: number | null): string { return val != null ? val.toFixed(2) : "—"; }

function RecetaPDFButton({ examenId }: { examenId: string }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const data = await obtenerDatosReceta(examenId);
      if (!data) { alert("No se pudo obtener los datos de la receta"); return; }
      await generarRecetaPDF(data as Parameters<typeof generarRecetaPDF>[0]);
    } catch {
      alert("Error al generar la receta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="px-2 py-1 text-[10px] font-medium bg-a-green-bg text-t-green border border-a-green-border rounded-md hover:opacity-80 transition disabled:opacity-50"
    >
      {loading ? "..." : "📄 Receta"}
    </button>
  );
}

function AnularExamenButton({ examenId }: { examenId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleAnular = () => {
    if (confirm("¿Estás seguro de que deseas anular este examen clínico? Esta acción no se puede deshacer.")) {
      startTransition(async () => {
        try {
          await anularExamen(examenId);
        } catch (e) {
          alert(e instanceof Error ? e.message : "Error al anular el examen");
        }
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleAnular}
      disabled={isPending}
      className="px-2 py-1 text-[10px] font-medium bg-card border border-red-500/30 text-t-red rounded-md hover:bg-red-500/10 transition disabled:opacity-50"
    >
      {isPending ? "..." : "✕ Anular"}
    </button>
  );
}

function ExamDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] text-t-muted uppercase tracking-wider">{label}</span>
      <p className="text-sm text-t-primary font-medium">{value}</p>
    </div>
  );
}
function formatCurrency(amount: number): string { return new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(amount); }
function getNestedName(rel: { nombre: string } | { nombre: string }[] | null): string {
  if (!rel) return "—"; if (Array.isArray(rel)) return rel[0]?.nombre ?? "—"; return rel.nombre;
}

// ── Modals / Extracted Components ────────────────────────

function VerDetalleExamenModal({ examen, onClose }: { examen: Examen, onClose: () => void }) {
  const optNombre = getNestedName(examen.optometrista);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-b-default">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-b-default bg-card">
          <div>
            <h2 className="text-lg font-bold text-t-primary">
              Detalle del Examen Clínico
              {examen.anulado && <span className="ml-3 px-2 py-0.5 text-xs font-bold uppercase bg-red-500/10 text-red-500 rounded border border-red-500/20">Anulado</span>}
            </h2>
            <p className="text-xs text-t-muted mt-1">
              Realizado el {fmtFecha(examen.fecha_examen, { month: "long" })} por {optNombre}
            </p>
          </div>
          <button onClick={onClose} className="text-t-muted hover:text-red-500 font-bold px-2 py-1 rounded hover:bg-red-500/10 transition">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Motivo Consulta */}
          {examen.motivo_consulta && (
             <div className="bg-card p-4 rounded-xl border border-b-default shadow-[var(--shadow-card)]">
               <h3 className="text-sm font-bold text-t-primary mb-2">Motivo de Consulta</h3>
               <p className="text-sm text-t-secondary">{examen.motivo_consulta}</p>
             </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Refracción Anterior */}
            <div className="rounded-xl p-4 border border-slate-500/40" style={{ background: "color-mix(in srgb, #64748b 8%, var(--bg-card))" }}>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-500/30">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Refracción Anterior</span>
                <span className="ml-auto px-2 py-0.5 text-[10px] font-medium bg-slate-500/20 text-slate-400 rounded-full">Previa</span>
              </div>
              <RecetaTabla
                od={{ esfera: examen.ra_od_esfera, cilindro: examen.ra_od_cilindro, eje: examen.ra_od_eje, adicion: examen.ra_od_adicion }}
                oi={{ esfera: examen.ra_oi_esfera, cilindro: examen.ra_oi_cilindro, eje: examen.ra_oi_eje, adicion: examen.ra_oi_adicion }}
              />
            </div>

            {/* Refracción Final */}
            <div className="rounded-xl p-4 border border-blue-500/40" style={{ background: "color-mix(in srgb, #3b82f6 8%, var(--bg-card))" }}>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-blue-500/30">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Refracción Final</span>
                <span className="ml-auto px-2 py-0.5 text-[10px] font-bold bg-blue-500/15 text-blue-400 rounded-full border border-blue-500/30">Recetada ✓</span>
              </div>
              <RecetaTabla
                od={{ esfera: examen.rf_od_esfera, cilindro: examen.rf_od_cilindro, eje: examen.rf_od_eje, adicion: examen.rf_od_adicion }}
                oi={{ esfera: examen.rf_oi_esfera, cilindro: examen.rf_oi_cilindro, eje: examen.rf_oi_eje, adicion: examen.rf_oi_adicion }}
                highlighted
              />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 bg-card border border-b-default rounded-xl p-4 shadow-[var(--shadow-card)]">
            <ExamDetail label="Agudeza Visual OD s/l" value={examen.av_od_sin_lentes || "—"} />
            <ExamDetail label="Agudeza Visual OI s/l" value={examen.av_oi_sin_lentes || "—"} />
            <ExamDetail label="Lente/Uso" value={examen.lente_uso || "—"} />
            <ExamDetail label="Distancia Pupilar" value={examen.dp != null ? `${examen.dp} mm` : "—"} />
            <ExamDetail label="Altura" value={examen.altura != null ? `${examen.altura} mm` : "—"} />
          </div>

          {examen.observaciones && (
             <div className="bg-a-slate-bg p-4 rounded-xl border border-b-default">
               <h3 className="text-sm font-bold text-t-primary mb-2">Observaciones</h3>
               <p className="text-sm text-t-secondary whitespace-pre-wrap">{examen.observaciones}</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
