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
    .select("id, nombre, direccion, telefono, activa, campanas_activas, zoho_sync_enabled, items_por_pagina, dias_kanban_entregado, created_at, updated_at")
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

export async function toggleZohoSync(sucursalId: string, habilitado: boolean) {
  const { supabase, tenant_id, rol } = await getUserContext();
  if (rol !== "administrador") return { success: false, error: "Sin permisos" };

  const { error } = await supabase
    .from("sucursales")
    .update({ zoho_sync_enabled: habilitado, updated_at: new Date().toISOString() })
    .eq("id", sucursalId)
    .eq("tenant_id", tenant_id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/configuracion");
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

export async function obtenerUsuariosTenant() {
  const { supabase, tenant_id, rol } = await getUserContext();
  if (rol !== "administrador") return { usuarios: [], error: "Sin permisos" };

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nombre, rol, sucursal_id, activo, sucursal:sucursales(nombre)")
    .eq("tenant_id", tenant_id)
    .order("nombre", { ascending: true });

  if (error) return { usuarios: [], error: error.message };

  // Cargar asignaciones multi-sucursal para cada usuario
  const usuariosIds = (data || []).map((u) => u.id);
  const { data: asignaciones } = await supabase
    .from("usuario_sucursales")
    .select("usuario_id, sucursal_id, sucursal:sucursales(id, nombre)")
    .eq("tenant_id", tenant_id)
    .in("usuario_id", usuariosIds);

  const asignacionesByUser = new Map<string, { id: string; nombre: string }[]>();
  (asignaciones || []).forEach((a) => {
    const suc = Array.isArray(a.sucursal) ? a.sucursal[0] : a.sucursal;
    if (!suc) return;
    const list = asignacionesByUser.get(a.usuario_id) || [];
    list.push({ id: suc.id, nombre: suc.nombre });
    asignacionesByUser.set(a.usuario_id, list);
  });

  const usuariosConSucursales = (data || []).map((u) => ({
    ...u,
    sucursales_asignadas: asignacionesByUser.get(u.id) || [],
  }));

  return { usuarios: usuariosConSucursales, error: null };
}

export async function asignarSucursalUsuario(targetUserId: string, sucursalId: string) {
  const { supabase, tenant_id, rol } = await getUserContext();
  if (rol !== "administrador") return { success: false, error: "Sin permisos" };

  // Verificar tenant membership
  const { data: targetUser } = await supabase
    .from("usuarios").select("id").eq("id", targetUserId).eq("tenant_id", tenant_id).single();
  if (!targetUser) return { success: false, error: "Usuario no encontrado" };

  const { data: suc } = await supabase
    .from("sucursales").select("id").eq("id", sucursalId).eq("tenant_id", tenant_id).single();
  if (!suc) return { success: false, error: "Sucursal no válida" };

  const { error } = await supabase.from("usuario_sucursales").insert({
    usuario_id: targetUserId,
    sucursal_id: sucursalId,
    tenant_id,
  });
  if (error && error.code !== "23505") return { success: false, error: error.message }; // 23505 = ya existe

  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

export async function quitarSucursalUsuario(targetUserId: string, sucursalId: string) {
  const { supabase, tenant_id, rol } = await getUserContext();
  if (rol !== "administrador") return { success: false, error: "Sin permisos" };

  // No permitir quitar la sucursal activa del usuario
  const { data: targetUser } = await supabase
    .from("usuarios").select("sucursal_id").eq("id", targetUserId).eq("tenant_id", tenant_id).single();
  if (!targetUser) return { success: false, error: "Usuario no encontrado" };
  if (targetUser.sucursal_id === sucursalId) {
    return { success: false, error: "No puedes quitar la sucursal activa del usuario. Cambia su sucursal principal primero." };
  }

  await supabase.from("usuario_sucursales")
    .delete()
    .eq("usuario_id", targetUserId)
    .eq("sucursal_id", sucursalId)
    .eq("tenant_id", tenant_id);

  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

export async function toggleUsuarioActivo(targetUserId: string, activo: boolean) {
  const { supabase, tenant_id, rol } = await getUserContext();
  if (rol !== "administrador") return { success: false, error: "Sin permisos" };

  // Verificar que el usuario target pertenece al mismo tenant
  const { data: targetUser } = await supabase
    .from("usuarios")
    .select("id")
    .eq("id", targetUserId)
    .eq("tenant_id", tenant_id)
    .single();

  if (!targetUser) return { success: false, error: "Usuario no encontrado" };

  const { error } = await supabase
    .from("usuarios")
    .update({ activo })
    .eq("id", targetUserId)
    .eq("tenant_id", tenant_id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

const ROLES_VALIDOS = ["administrador", "optometrista", "asesor_visual", "laboratorio", "contador"] as const;

export async function actualizarUsuario(targetUserId: string, payload: { rol: string; sucursal_id: string }) {
  const { supabase, tenant_id, rol } = await getUserContext();
  if (rol !== "administrador") return { success: false, error: "Sin permisos" };

  if (!(ROLES_VALIDOS as readonly string[]).includes(payload.rol)) {
    return { success: false, error: "Rol inválido" };
  }

  // Verificar que la sucursal pertenece al tenant
  const { data: suc } = await supabase
    .from("sucursales")
    .select("id")
    .eq("id", payload.sucursal_id)
    .eq("tenant_id", tenant_id)
    .single();

  if (!suc) return { success: false, error: "Sucursal no válida" };

  // Verificar que el usuario target pertenece al mismo tenant
  const { data: targetUser } = await supabase
    .from("usuarios")
    .select("id")
    .eq("id", targetUserId)
    .eq("tenant_id", tenant_id)
    .single();

  if (!targetUser) return { success: false, error: "Usuario no encontrado" };

  const { error } = await supabase
    .from("usuarios")
    .update({ rol: payload.rol, sucursal_id: payload.sucursal_id })
    .eq("id", targetUserId)
    .eq("tenant_id", tenant_id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/configuracion");
  revalidatePath("/", "layout");
  return { success: true };
}
