"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { svFechaInicioUTC, svFechaFinUTC } from "@/lib/date-sv";

export async function obtenerOrdenesLaboratorio() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: perfil } = await supabase
    .from("usuarios").select("tenant_id, sucursal_id").eq("id", user.id).single();
  if (!perfil) throw new Error("Perfil no encontrado");

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
    .eq("tenant_id", perfil.tenant_id)
    .eq("tipo", "orden_trabajo")
    .neq("estado", "cancelada")
    .order("created_at", { ascending: false })
    .limit(200);

  if (ordenesError) throw new Error(ordenesError.message);

  if (!ordenes || ordenes.length === 0) return [];

  const ordenIds = ordenes.map((o) => o.id);

  // Get latest lab status for each order
  const { data: labEstados, error: labError } = await supabase
    .from("laboratorio_estados")
    .select("*")
    .in("orden_id", ordenIds)
    .eq("tenant_id", perfil.tenant_id)
    .order("updated_at", { ascending: false });

  if (labError) throw new Error(labError.message);

  // Group by orden_id to get only the latest status
  const latestStates = new Map<string, any>();
  for (const lab of (labEstados || [])) {
    if (!latestStates.has(lab.orden_id)) {
      latestStates.set(lab.orden_id, lab);
    }
  }

  // Get lab name from orden_laboratorio_datos joined with laboratorios
  const { data: labDatos } = await supabase
    .from("orden_laboratorio_datos")
    .select("orden_id, laboratorio:laboratorios(nombre)")
    .in("orden_id", ordenIds);

  const labNombreMap = new Map<string, string | null>();
  for (const ld of (labDatos || [])) {
    const lab = ld.laboratorio;
    const nombre = Array.isArray(lab) ? lab[0]?.nombre : (lab as any)?.nombre ?? null;
    labNombreMap.set(ld.orden_id, nombre);
  }

  return ordenes.map((orden) => ({
    ...orden,
    laboratorio: latestStates.get(orden.id) || null,
    laboratorioNombre: labNombreMap.get(orden.id) ?? null,
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

  // 1. Get the order with details and patient reference (verificar tenant)
  const { data: usuario } = await supabase.from("usuarios").select("tenant_id, sucursal_id").eq("id", user.id).single();

  const { data: orden } = await supabase
    .from("ordenes")
    .select("*, paciente:pacientes!ordenes_paciente_id_fkey(id, nombre, telefono, email)")
    .eq("id", ordenId)
    .eq("tenant_id", usuario?.tenant_id)
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
    .eq("tenant_id", usuario?.tenant_id)
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
    .from("usuarios").select("tenant_id").eq("id", user.id).single();
  if (!usuario) throw new Error("Usuario no encontrado");

  // Whitelist campos permitidos — nunca spread directo de datos externos
  const payload = {
    orden_id: ordenId,
    tenant_id: usuario.tenant_id,
    tipo_lente:       datos.tipo_lente       ?? null,
    material_lente:   datos.material_lente   ?? null,
    tratamiento_lente: datos.tratamiento_lente ?? null,
    color_lente:      datos.color_lente      ?? null,
    tipo_aro:         datos.tipo_aro         ?? null,
    marca_aro:        datos.marca_aro        ?? null,
    color_aro:        datos.color_aro        ?? null,
    tamano_aro:       datos.tamano_aro       ?? null,
    observaciones:    datos.observaciones    ?? null,
    laboratorio_id:   datos.laboratorio_id   ?? null,
  };

  const { error } = await supabase
    .from("orden_laboratorio_datos")
    .upsert(payload, { onConflict: "orden_id" });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/laboratorio");
  revalidatePath(`/dashboard/ventas/${ordenId}`);
}

/* ── Laboratorios activos para selección ───────────────── */
export async function obtenerLaboratoriosActivos() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: usuario } = await supabase
    .from("usuarios").select("tenant_id").eq("id", user.id).single();
  if (!usuario) return [];
  const { data } = await supabase
    .from("laboratorios")
    .select("id, nombre")
    .eq("tenant_id", usuario.tenant_id)
    .eq("activo", true)
    .order("nombre");
  return data || [];
}

/* ── Órdenes para generar lista PDF ────────────────────── */
export async function obtenerOrdenesParaListaPDF(filtros: {
  laboratorio_id?: string;
  campana_id?: string;
  estado?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: usuario } = await supabase
    .from("usuarios").select("tenant_id").eq("id", user.id).single();
  if (!usuario) return [];

  // Obtener datos de laboratorio con laboratorio_id
  let labQuery = supabase
    .from("orden_laboratorio_datos")
    .select("orden_id, laboratorio_id, tipo_lente, material_lente, tratamiento_lente, color_lente, marca_aro, color_aro, tamano_aro, tipo_aro, observaciones, laboratorio:laboratorios(nombre)")
    .eq("tenant_id", usuario.tenant_id);

  if (filtros.laboratorio_id) {
    labQuery = labQuery.eq("laboratorio_id", filtros.laboratorio_id);
  }

  const { data: labDatos } = await labQuery;
  if (!labDatos || labDatos.length === 0) return [];

  const ordenIds = labDatos.map((l) => l.orden_id);

  // Obtener las órdenes correspondientes
  let ordenQuery = supabase
    .from("ordenes")
    .select("id, created_at, estado, total, paciente:pacientes(nombre), campana:campanas(nombre)")
    .eq("tipo", "orden_trabajo")
    .eq("tenant_id", usuario.tenant_id)
    .in("id", ordenIds);

  if (filtros.campana_id) ordenQuery = ordenQuery.eq("campana_id", filtros.campana_id);
  // El Salvador = UTC-6 (fijo, sin horario de verano).
  // Supabase guarda en UTC, así que convertimos las fechas SV → UTC antes de filtrar.
  // Inicio del día SV (00:00 SV) = 06:00 UTC mismo día
  // Fin del día SV (23:59:59 SV) = 05:59:59 UTC del día siguiente
  if (filtros.fecha_desde) ordenQuery = ordenQuery.gte("created_at", svFechaInicioUTC(filtros.fecha_desde));
  if (filtros.fecha_hasta) ordenQuery = ordenQuery.lte("created_at", svFechaFinUTC(filtros.fecha_hasta));

  const { data: ordenes } = await ordenQuery.order("created_at", { ascending: false });

  // Obtener últimos estados de laboratorio
  const { data: estados } = await supabase
    .from("laboratorio_estados")
    .select("orden_id, estado")
    .in("orden_id", ordenIds)
    .order("updated_at", { ascending: false });

  const latestEstado = new Map<string, string>();
  for (const e of estados || []) {
    if (!latestEstado.has(e.orden_id)) latestEstado.set(e.orden_id, e.estado);
  }

  const labMap = new Map(labDatos.map((l) => [l.orden_id, l]));

  return (ordenes || []).filter((o) => {
    if (!filtros.estado) return true;
    const estadoLab = latestEstado.get(o.id) || "pendiente";
    return estadoLab === filtros.estado;
  }).map((o) => {
    const ld = labMap.get(o.id);
    const lab = ld?.laboratorio;
    return {
      id: o.id,
      created_at: o.created_at,
      paciente: Array.isArray(o.paciente) ? o.paciente[0]?.nombre : (o.paciente as any)?.nombre || "—",
      campana: Array.isArray(o.campana) ? o.campana[0]?.nombre : (o.campana as any)?.nombre || null,
      laboratorio: Array.isArray(lab) ? lab[0]?.nombre : (lab as any)?.nombre || "Sin asignar",
      estadoLab: latestEstado.get(o.id) || "pendiente",
      tipo_lente: ld?.tipo_lente || "",
      material_lente: ld?.material_lente || "",
      tratamiento_lente: ld?.tratamiento_lente || "",
      color_lente: ld?.color_lente || "",
      marca_aro: ld?.marca_aro || "",
      color_aro: (ld as any)?.color_aro || "",
      tamano_aro: (ld as any)?.tamano_aro || "",
      tipo_aro: ld?.tipo_aro || "",
      observaciones: ld?.observaciones || "",
      total: Number(o.total),
    };
  });
}

/* ── Lista de campañas para selector PDF ────────────────── */
export async function obtenerCampanasParaFiltro() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: usuario } = await supabase
    .from("usuarios").select("tenant_id, sucursal_id").eq("id", user.id).single();
  if (!usuario) return [];
  const { data } = await supabase
    .from("campanas")
    .select("id, nombre")
    .eq("tenant_id", usuario.tenant_id)
    .eq("sucursal_id", usuario.sucursal_id)
    .order("fecha_inicio", { ascending: false });
  return data || [];
}

/* ── Fetch all data to show in Kanban Card Modal ───────── */
export async function obtenerDatosParaModalLab(ordenId: string) {
  // We can reuse the same as obtenerDatosSobreLaboratorio since it covers all info needed
  return obtenerDatosSobreLaboratorio(ordenId);
}

