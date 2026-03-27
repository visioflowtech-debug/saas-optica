"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function getUserContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: perfil } = await supabase
    .from("usuarios").select("tenant_id, rol").eq("id", user.id).single();
  if (!perfil) throw new Error("Perfil no encontrado");
  return { supabase, ...perfil };
}

export async function obtenerConfiguracion() {
  const { supabase, tenant_id } = await getUserContext();

  const { data: empresa, error: empresaError } = await supabase
    .from("empresas")
    .select("id, nombre, nit, logo_url, email, created_at, updated_at")
    .eq("id", tenant_id)
    .single();

  if (empresaError && empresaError.code !== "PGRST116") {
    // PGRST116 is "no rows found", meaning they don't have an active tenant row they can see.
    console.error("Error fetching empresa:", empresaError);
    return { empresa: null, sucursales: [], error: empresaError.message };
  }

  const { data: sucursales, error: sucursalError } = await supabase
    .from("sucursales")
    .select("id, nombre, direccion, telefono, activa, campanas_activas, items_por_pagina, dias_kanban_entregado, created_at, updated_at")
    .eq("tenant_id", tenant_id)
    .order("created_at", { ascending: true });

  if (sucursalError) {
    console.error("Error fetching sucursales:", sucursalError);
    return { empresa: empresa || null, sucursales: [], error: sucursalError.message };
  }

  return { 
    empresa: empresa || null, 
    sucursales: sucursales || [], 
    error: null 
  };
}

export async function actualizarEmpresa(_id: string, payload: { nombre: string; nit: string; logo_url: string; email: string }) {
  const { supabase, tenant_id, rol } = await getUserContext();
  if (rol !== "administrador") return { success: false, error: "Sin permisos" };

  // Validar logo_url: solo URLs http/https o vacío
  if (payload.logo_url && !/^https?:\/\/.+/.test(payload.logo_url)) {
    return { success: false, error: "URL de logo inválida" };
  }

  const { error } = await supabase
    .from("empresas")
    .update({
      nombre: payload.nombre,
      nit: payload.nit,
      logo_url: payload.logo_url || null,
      email: payload.email || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenant_id); // Siempre del contexto autenticado, no del parámetro

  if (error) {
    console.error("Error updating empresa:", error);
    return { success: false, error: "Error al actualizar empresa" };
  }

  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

export async function actualizarSucursal(id: string, payload: { nombre: string; direccion: string; telefono: string }) {
  const { supabase, tenant_id, rol } = await getUserContext();
  if (rol !== "administrador") return { success: false, error: "Sin permisos" };

  const { error } = await supabase
    .from("sucursales")
    .update({
      nombre: payload.nombre,
      direccion: payload.direccion,
      telefono: payload.telefono,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenant_id);

  if (error) {
    console.error("Error updating sucursal:", error);
    return { success: false, error: "Error al actualizar sucursal" };
  }

  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

export async function actualizarConfigOperacional(sucursalId: string, payload: { items_por_pagina: number; dias_kanban_entregado: number }) {
  const { supabase, tenant_id, rol } = await getUserContext();
  if (rol !== "administrador") return { success: false, error: "Sin permisos" };

  const items = Math.min(200, Math.max(5, Math.round(payload.items_por_pagina)));
  const dias = Math.min(365, Math.max(1, Math.round(payload.dias_kanban_entregado)));

  const { error } = await supabase
    .from("sucursales")
    .update({ items_por_pagina: items, dias_kanban_entregado: dias, updated_at: new Date().toISOString() })
    .eq("id", sucursalId)
    .eq("tenant_id", tenant_id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/configuracion");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function toggleCampanasActivas(sucursalId: string, activas: boolean) {
  const { supabase, tenant_id, rol } = await getUserContext();
  if (rol !== "administrador") return { success: false, error: "Sin permisos" };

  const { error } = await supabase
    .from("sucursales")
    .update({ campanas_activas: activas, updated_at: new Date().toISOString() })
    .eq("id", sucursalId)
    .eq("tenant_id", tenant_id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/configuracion");
  revalidatePath("/", "layout");
  return { success: true };
}
