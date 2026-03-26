"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function getUserContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("tenant_id, sucursal_id, rol")
    .eq("id", user.id)
    .single();

  if (!perfil) throw new Error("Perfil no encontrado");
  return { supabase, userId: user.id, ...perfil };
}

export async function obtenerCampanas() {
  const { supabase, tenant_id, sucursal_id } = await getUserContext();

  const { data, error } = await supabase
    .from("campanas")
    .select("id, nombre, descripcion, fecha_inicio, fecha_fin, activa, created_at")
    .eq("tenant_id", tenant_id)
    .eq("sucursal_id", sucursal_id)
    .order("created_at", { ascending: false });

  if (error) return { campanas: [], error: error.message };
  return { campanas: data || [], error: null };
}

export async function obtenerCampana(id: string) {
  const { supabase, tenant_id, sucursal_id } = await getUserContext();

  const { data: campana, error } = await supabase
    .from("campanas")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenant_id)
    .eq("sucursal_id", sucursal_id)
    .single();

  if (error || !campana) return null;

  // Solo conteos — HEAD queries que no retornan filas (evita problema de RLS con ordenes)
  const [{ count: totalPacientes }, { count: totalExaminados }] = await Promise.all([
    supabase.from("pacientes")
      .select("id", { count: "exact", head: true })
      .eq("campana_id", id).eq("tenant_id", tenant_id),
    supabase.from("examenes_clinicos")
      .select("id", { count: "exact", head: true })
      .eq("campana_id", id).eq("tenant_id", tenant_id),
  ]);

  return {
    campana,
    counts: {
      totalPacientes: totalPacientes ?? 0,
      totalExaminados: totalExaminados ?? 0,
    },
  };
}

export async function obtenerPacientesDeCampana(campanaId: string) {
  const { supabase, tenant_id } = await getUserContext();

  const { data } = await supabase
    .from("pacientes")
    .select("id, nombre, telefono, email, created_at")
    .eq("campana_id", campanaId)
    .eq("tenant_id", tenant_id)
    .order("created_at", { ascending: false })
    .limit(500);

  return data || [];
}

export async function crearCampana(formData: FormData) {
  const { supabase, tenant_id, sucursal_id, rol } = await getUserContext();

  if (rol !== "administrador") {
    return redirect("/dashboard/campanas?error=Sin+permisos");
  }

  // Verificar que la sucursal tiene campanas activas
  const { data: suc } = await supabase
    .from("sucursales")
    .select("campanas_activas")
    .eq("id", sucursal_id)
    .single();

  if (!suc?.campanas_activas) {
    return redirect("/dashboard/campanas?error=Campañas+no+habilitadas+en+esta+sucursal");
  }

  const nombre = (formData.get("nombre") as string)?.trim();
  const descripcion = (formData.get("descripcion") as string)?.trim() || null;
  const fecha_inicio = (formData.get("fecha_inicio") as string) || null;
  const fecha_fin = (formData.get("fecha_fin") as string) || null;

  if (!nombre) return redirect("/dashboard/campanas/nueva?error=El+nombre+es+requerido");

  const { error } = await supabase.from("campanas").insert({
    tenant_id,
    sucursal_id,
    nombre,
    descripcion,
    fecha_inicio,
    fecha_fin,
    activa: true,
  });

  if (error) return redirect("/dashboard/campanas/nueva?error=" + encodeURIComponent(error.message));

  revalidatePath("/dashboard/campanas");
  redirect("/dashboard/campanas");
}

export async function toggleCampanaActiva(campanaId: string, activa: boolean) {
  const { supabase, tenant_id } = await getUserContext();

  const { error } = await supabase
    .from("campanas")
    .update({ activa, updated_at: new Date().toISOString() })
    .eq("id", campanaId)
    .eq("tenant_id", tenant_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/campanas");
  return { success: true };
}

export async function obtenerVentasDeCampana(campanaId: string) {
  const { supabase, tenant_id } = await getUserContext();

  const { data } = await supabase
    .from("ordenes")
    .select("id, created_at, tipo, estado, total, paciente_id, notas, paciente:pacientes(nombre)")
    .eq("campana_id", campanaId)
    .eq("tenant_id", tenant_id)
    .order("created_at", { ascending: false })
    .limit(500);

  return (data || []) as unknown as Array<{
    id: string;
    created_at: string;
    tipo: string;
    estado: string;
    total: number;
    paciente_id: string;
    notas: string | null;
    paciente: { nombre: string } | null;
  }>;
}

export async function obtenerIngresosDeCampana(ordenIds: string[]) {
  if (ordenIds.length === 0) return 0;
  const { supabase, tenant_id } = await getUserContext();
  const { data } = await supabase
    .from("pagos")
    .select("monto")
    .in("orden_id", ordenIds)
    .eq("tenant_id", tenant_id);
  return (data || []).reduce((s, p) => s + Number(p.monto || 0), 0);
}

export async function obtenerGastosDeCampana(campanaId: string) {
  const { supabase, tenant_id } = await getUserContext();

  const { data } = await supabase
    .from("gastos")
    .select("id, concepto, categoria, monto, fecha, notas, created_at")
    .eq("campana_id", campanaId)
    .eq("tenant_id", tenant_id)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  return (data || []) as Array<{
    id: string;
    concepto: string;
    categoria: string;
    monto: number;
    fecha: string;
    notas: string | null;
    created_at: string;
  }>;
}

export async function obtenerCampanasActivasDeSucursal() {
  const { supabase, tenant_id, sucursal_id } = await getUserContext();
  const { data } = await supabase
    .from("campanas")
    .select("id, nombre")
    .eq("sucursal_id", sucursal_id)
    .eq("tenant_id", tenant_id)
    .eq("activa", true)
    .order("nombre");

  return data || [];
}
