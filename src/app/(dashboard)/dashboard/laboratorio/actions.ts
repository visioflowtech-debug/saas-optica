"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function obtenerOrdenesLaboratorio() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Get orders that are "orden_trabajo" and not "cancelada"
  const { data: ordenes, error: ordenesError } = await supabase
    .from("ordenes")
    .select(`
      id,
      created_at,
      tipo,
      estado,
      total,
      paciente:pacientes!ordenes_paciente_id_fkey(nombre),
      asesor:usuarios!ordenes_asesor_id_fkey(nombre)
    `)
    .eq("tipo", "orden_trabajo")
    .neq("estado", "cancelada")
    .order("created_at", { ascending: false });

  if (ordenesError) throw new Error(ordenesError.message);

  if (!ordenes || ordenes.length === 0) return [];

  const ordenIds = ordenes.map((o) => o.id);

  // Get latest lab status for each order
  const { data: labEstados, error: labError } = await supabase
    .from("laboratorio_estados")
    .select("*")
    .in("orden_id", ordenIds)
    .order("updated_at", { ascending: false });

  if (labError) throw new Error(labError.message);

  // Group by orden_id to get only the latest status
  const latestStates = new Map<string, any>();
  for (const lab of (labEstados || [])) {
    if (!latestStates.has(lab.orden_id)) {
      latestStates.set(lab.orden_id, lab);
    }
  }

  return ordenes.map((orden) => ({
    ...orden,
    laboratorio: latestStates.get(orden.id) || null,
  }));
}

export async function actualizarEstadoLaboratorio(ordenId: string, nuevoEstado: string, laboratorioExterno?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Get user tenant
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!usuario) throw new Error("Usuario no encontrado");

  const { error } = await supabase.from("laboratorio_estados").insert({
    orden_id: ordenId,
    tenant_id: usuario.tenant_id,
    estado: nuevoEstado,
    laboratorio_externo: laboratorioExterno || null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/laboratorio");
  revalidatePath(`/dashboard/ventas/${ordenId}`);
}

/* ── Generación de Sobre de Laboratorio PDF ─────────────── */
export async function obtenerDatosSobreLaboratorio(ordenId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // 1. Get the order with details and patient reference
  const { data: orden } = await supabase
    .from("ordenes")
    .select("*, paciente:pacientes!ordenes_paciente_id_fkey(id, nombre, telefono, email)")
    .eq("id", ordenId)
    .single();

  if (!orden) throw new Error("Orden no encontrada");

  const { data: detalles } = await supabase
    .from("orden_detalle")
    .select("*")
    .eq("orden_id", ordenId)
    .order("created_at", { ascending: true });

  const paciente = Array.isArray(orden.paciente) ? orden.paciente[0] : orden.paciente;

  let examenFinal = null;

  // 2. Output the latest NO ANULADO clinical exam for this patient
  if (paciente?.id) {
    const { data: ultimosExamenes } = await supabase
      .from("examenes_clinicos")
      .select("*")
      .eq("paciente_id", paciente.id)
      .eq("anulado", false)
      .order("fecha_examen", { ascending: false })
      .limit(1);

    if (ultimosExamenes && ultimosExamenes.length > 0) {
      examenFinal = ultimosExamenes[0];
    }
  }

  // 3. Get Empresa Info
  const { data: usuario } = await supabase.from("usuarios").select("tenant_id, sucursal_id").eq("id", user.id).single();
  let empresa: { nombre: string; logo_url: string | null; email: string | null } = { nombre: "Óptica", logo_url: null, email: null };
  let sucursalTel: string | null = null;
  
  if (usuario) {
    const { data: emp } = await supabase.from("empresas").select("nombre, logo_url, email").eq("id", usuario.tenant_id).single();
    if (emp) empresa = { nombre: emp.nombre, logo_url: emp.logo_url, email: emp.email };

    if (usuario.sucursal_id) {
      const { data: suc } = await supabase.from("sucursales").select("telefono").eq("id", usuario.sucursal_id).single();
      if (suc) sucursalTel = suc.telefono;
    }
  }

  // 4. Get the specific Lab Datos if they exist
  const { data: labDatos } = await supabase
    .from("orden_laboratorio_datos")
    .select("*")
    .eq("orden_id", ordenId)
    .single();

  return {
    empresa,
    sucursalTel,
    orden,
    detalles: detalles || [],
    paciente,
    examen: examenFinal,
    laboratorioDatos: labDatos,
  };
}

/* ── Save Custom Lab Data ───────────────────────────────── */
export async function guardarDatosLaboratorio(ordenId: string, datos: any) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!usuario) throw new Error("Usuario no encontrado");

  const payload = { ...datos, orden_id: ordenId, tenant_id: usuario.tenant_id };

  // upsert
  const { error } = await supabase
    .from("orden_laboratorio_datos")
    .upsert(payload, { onConflict: "orden_id" });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/laboratorio");
}

/* ── Fetch all data to show in Kanban Card Modal ───────── */
export async function obtenerDatosParaModalLab(ordenId: string) {
  // We can reuse the same as obtenerDatosSobreLaboratorio since it covers all info needed
  return obtenerDatosSobreLaboratorio(ordenId);
}

