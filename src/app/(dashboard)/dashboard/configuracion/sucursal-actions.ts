"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function cambiarSucursal(sucursalId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Verificar que la sucursal pertenece al mismo tenant del usuario
  const { data: perfil } = await supabase
    .from("usuarios")
    .select("tenant_id, rol")
    .eq("id", user.id)
    .single();

  if (!perfil) redirect("/login");

  // Solo admin puede cambiar de sucursal
  if (perfil.rol !== "administrador") {
    return { error: "Sin permisos para cambiar de sucursal" };
  }

  // Verificar que la sucursal es del mismo tenant
  const { data: sucursal } = await supabase
    .from("sucursales")
    .select("id, nombre")
    .eq("id", sucursalId)
    .eq("tenant_id", perfil.tenant_id)
    .single();

  if (!sucursal) {
    return { error: "Sucursal no válida" };
  }

  // Actualizar la sucursal activa del usuario
  const { error } = await supabase
    .from("usuarios")
    .update({ sucursal_id: sucursalId })
    .eq("id", user.id);

  if (error) {
    return { error: "Error al cambiar sucursal: " + error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function obtenerSucursalesDelTenant() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("tenant_id, rol")
    .eq("id", user.id)
    .single();

  if (!perfil || perfil.rol !== "administrador") return [];

  const { data: sucursales } = await supabase
    .from("sucursales")
    .select("id, nombre, activa")
    .eq("tenant_id", perfil.tenant_id)
    .eq("activa", true)
    .order("nombre");

  return sucursales || [];
}
