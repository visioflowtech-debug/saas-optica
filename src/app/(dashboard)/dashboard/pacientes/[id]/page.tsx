import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Paciente360Tabs from "./paciente-360-tabs";

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
  if (ordenes && ordenes.length > 0) {
    const ordenIds = ordenes.map((o) => o.id);
    const { data: labs } = await supabase
      .from("laboratorio_estados").select("orden_id, estado, laboratorio_externo")
      .in("orden_id", ordenIds).order("updated_at", { ascending: false });
    if (labs) labs.forEach((l) => {
      if (!labEstados[l.orden_id]) labEstados[l.orden_id] = { estado: l.estado, laboratorio_externo: l.laboratorio_externo };
    });
  }

  const edad = paciente.fecha_nacimiento ? calculateAge(paciente.fecha_nacimiento) : null;
  const tags = Array.isArray(paciente.etiquetas_medicas) ? (paciente.etiquetas_medicas as string[]) : [];

  return (
    <div className="space-y-6">
      <Link href="/dashboard/pacientes" className="inline-flex items-center gap-1 text-sm text-t-muted hover:text-t-primary transition">
        ← Volver a pacientes
      </Link>

      {/* Patient Header */}
      <div className="flex flex-col sm:flex-row items-start gap-6 p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {paciente.nombre.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-t-primary truncate">{paciente.nombre}</h1>
              <p className="text-t-secondary text-sm mt-1">
                {edad !== null ? `${edad} años` : ""}
                {paciente.profesion ? ` · ${paciente.profesion}` : ""}
                {paciente.telefono ? ` · ${paciente.telefono}` : ""}
              </p>
            </div>
            <Link
              href={`/dashboard/examenes/nuevo?paciente_id=${id}`}
              className="hidden sm:inline-flex px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
            >
              + Nuevo Examen
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {tags.map((tag) => (
              <span key={tag} className="px-2.5 py-0.5 text-xs font-medium bg-a-red-bg text-t-red border border-a-red-border rounded-full">{tag}</span>
            ))}
            {paciente.acepta_marketing && (
              <span className="px-2.5 py-0.5 text-xs font-medium bg-a-green-bg text-t-green border border-a-green-border rounded-full">📩 Marketing</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="grid grid-cols-3 gap-4">
            <StatMini label="Exámenes" value={String(examenes?.length ?? 0)} />
            <StatMini label="Compras" value={String(ordenes?.length ?? 0)} />
            <StatMini label="Total" value={formatCurrency(ordenes?.reduce((s, o) => s + Number(o.total), 0) ?? 0)} />
          </div>
        </div>
      </div>

      <Paciente360Tabs paciente={paciente} examenes={examenes ?? []} ordenes={ordenes ?? []} labEstados={labEstados} edad={edad} />
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-t-primary">{value}</p>
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
