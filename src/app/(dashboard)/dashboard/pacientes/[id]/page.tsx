import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Paciente360Tabs from "./paciente-360-tabs";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { eliminarPaciente } from "../../eliminar-actions";

export default async function Paciente360Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: paciente, error } = await supabase
    .from("pacientes").select("*").eq("id", id).single();
  if (error || !paciente) notFound();

  const { data: examenes } = await supabase
    .from("examenes_clinicos")
    .select("*, optometrista:usuarios!examenes_clinicos_optometrista_id_fkey(nombre)")
    .eq("paciente_id", id).order("fecha_examen", { ascending: false }).limit(10);

  const { data: ordenes } = await supabase
    .from("ordenes")
    .select("*, asesor:usuarios!ordenes_asesor_id_fkey(nombre)")
    .eq("paciente_id", id).order("created_at", { ascending: false }).limit(10);

  let labEstados: Record<string, { estado: string; laboratorio_externo: string | null }> = {};
  let totalPagado = 0;
  if (ordenes && ordenes.length > 0) {
    const ordenIds = ordenes.map((o) => o.id);
    const [{ data: labs }, { data: pagos }] = await Promise.all([
      supabase.from("laboratorio_estados").select("orden_id, estado, laboratorio_externo")
        .in("orden_id", ordenIds).order("updated_at", { ascending: false }),
      supabase.from("pagos").select("orden_id, monto").in("orden_id", ordenIds),
    ]);
    if (labs) labs.forEach((l) => {
      if (!labEstados[l.orden_id]) labEstados[l.orden_id] = { estado: l.estado, laboratorio_externo: l.laboratorio_externo };
    });
    if (pagos) totalPagado = pagos.reduce((s, p) => s + Number(p.monto), 0);
  }

  const totalCompras = ordenes
    ?.filter((o) => o.estado !== "cancelada")
    .reduce((s, o) => s + Number(o.total), 0) ?? 0;
  const saldoPendiente = Math.max(0, totalCompras - totalPagado);

  const edad = paciente.fecha_nacimiento ? calculateAge(paciente.fecha_nacimiento) : null;
  const tags = Array.isArray(paciente.etiquetas_medicas) ? (paciente.etiquetas_medicas as string[]) : [];

  return (
    <div className="space-y-6">
      <Link href="/dashboard/pacientes" className="inline-flex items-center gap-1 text-sm text-t-muted hover:text-t-primary transition">
        ← Volver a pacientes
      </Link>

      {/* Patient Header */}
      <div className="flex items-start gap-4 p-5 sm:p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl sm:text-2xl font-bold shrink-0">
          {paciente.nombre.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          {/* Name + action buttons */}
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-t-primary truncate">{paciente.nombre}</h1>
              <p className="text-t-secondary text-sm mt-0.5">
                {edad !== null ? `${edad} años` : ""}
                {paciente.profesion ? ` · ${paciente.profesion}` : ""}
                {paciente.telefono ? ` · ${paciente.telefono}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              <Link
                href={`/dashboard/examenes/nuevo?paciente_id=${id}`}
                className="hidden sm:inline-flex px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm whitespace-nowrap"
              >
                + Nuevo Examen
              </Link>
              <Link
                href={`/dashboard/pacientes/${id}/editar`}
                className="px-3 py-1.5 bg-card border border-b-default text-t-secondary hover:text-t-primary text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
              >
                Editar
              </Link>
              <ConfirmDeleteButton
                label="Eliminar"
                confirmText={`¿Eliminar a ${paciente.nombre}? Se borrarán todos sus exámenes, órdenes y pagos. Esta acción no se puede deshacer.`}
                onConfirm={eliminarPaciente.bind(null, id)}
              />
            </div>
          </div>

          {/* Tags */}
          {(tags.length > 0 || paciente.acepta_marketing) && (
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((tag) => (
                <span key={tag} className="px-2.5 py-0.5 text-xs font-medium bg-a-red-bg text-t-red border border-a-red-border rounded-full">{tag}</span>
              ))}
              {paciente.acepta_marketing && (
                <span className="px-2.5 py-0.5 text-xs font-medium bg-a-green-bg text-t-green border border-a-green-border rounded-full">📩 Marketing</span>
              )}
            </div>
          )}

          {/* Stats — always below name row, never beside buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-b-subtle">
            <StatMini label="Exámenes" value={String(examenes?.length ?? 0)} />
            <StatMini label="Compras" value={String(ordenes?.filter(o => o.estado !== "cancelada").length ?? 0)} />
            <StatMini label="Total" value={formatCurrency(totalCompras)} />
            <StatMini label="Pendiente" value={formatCurrency(saldoPendiente)} highlight={saldoPendiente > 0} />
          </div>
        </div>
      </div>

      <Paciente360Tabs paciente={paciente} examenes={examenes ?? []} ordenes={ordenes ?? []} labEstados={labEstados} edad={edad} />
    </div>
  );
}

function StatMini({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${highlight ? "text-amber-500" : "text-t-primary"}`}>{value}</p>
      <p className="text-[10px] text-t-muted uppercase tracking-wider">{label}</p>
    </div>
  );
}

function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(amount);
}
