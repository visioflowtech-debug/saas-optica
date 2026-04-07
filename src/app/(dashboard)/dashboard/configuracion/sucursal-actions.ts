"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function cambiarSucursal(sucursalId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("tenant_id, rol")
    .eq("id", user.id)
    .single();
  if (!perfil) redirect("/login");

  // Verificar que el usuario tiene acceso a esta sucursal
  // Admins pueden cambiar a cualquier sucursal del tenant
  // Otros usuarios solo a las sucursales asignadas en usuario_sucursales
  if (perfil.rol === "administrador") {
    const { data: sucursal } = await supabase
      .from("sucursales")
      .select("id")
      .eq("id", sucursalId)
      .eq("tenant_id", perfil.tenant_id)
      .single();
    if (!sucursal) return { error: "Sucursal no válida" };
  } else {
    const { data: asignacion } = await supabase
      .from("usuario_sucursales")
      .select("sucursal_id")
      .eq("usuario_id", user.id)
      .eq("sucursal_id", sucursalId)
      .single();
    if (!asignacion) return { error: "Sin acceso a esa sucursal" };
  }

  const { error } = await supabase
    .from("usuarios")
    .update({ sucursal_id: sucursalId })
    .eq("id", user.id)
    .eq("tenant_id", perfil.tenant_id);

  if (error) return { error: "Error al cambiar sucursal: " + error.message };

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
