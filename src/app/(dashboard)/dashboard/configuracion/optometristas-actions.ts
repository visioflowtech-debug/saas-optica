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

export interface OptometristaItem {
  id: string;
  nombre: string;
  activo: boolean;
  numero_junta: string | null;
}

export async function obtenerOptometristas(): Promise<OptometristaItem[]> {
  const { supabase, tenant_id } = await getUserContext();
  const { data } = await supabase
    .from("categorias_config")
    .select("id, label, activo, descripcion")
    .eq("tenant_id", tenant_id)
    .eq("modulo", "optometristas")
    .order("label");
  return (data || []).map((r) => ({ id: r.id, nombre: r.label, activo: r.activo, numero_junta: r.descripcion ?? null }));
}

export async function crearOptometrista(formData: FormData) {
  const { supabase, tenant_id, rol } = await getUserContext();
  if (rol !== "administrador") return { error: "Sin permisos" };
  const nombre = (formData.get("nombre") as string)?.trim();
  const numero_junta = (formData.get("numero_junta") as string)?.trim() || null;
  if (!nombre) return { error: "El nombre es requerido" };
  const valor = nombre.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_áéíóúüñ]/g, "");
  const { error } = await supabase.from("categorias_config").insert({
    tenant_id,
    modulo: "optometristas",
    valor: valor || nombre.substring(0, 30),
    label: nombre,
    activo: true,
    descripcion: numero_junta,
  });
  if (error && error.code !== "23505") return { error: error.message };
  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard/examenes");
  return { success: true };
}

export async function actualizarNumeroJunta(id: string, numero_junta: string) {
  const { supabase, tenant_id, rol } = await getUserContext();
  if (rol !== "administrador") return { error: "Sin permisos" };
  const { error } = await supabase.from("categorias_config")
    .update({ descripcion: numero_junta || null })
    .eq("id", id).eq("tenant_id", tenant_id).eq("modulo", "optometristas");
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

export async function toggleOptometrista(id: string, activo: boolean) {
  const { supabase, tenant_id } = await getUserContext();
  const { error } = await supabase.from("categorias_config")
    .update({ activo }).eq("id", id).eq("tenant_id", tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

export async function eliminarOptometrista(id: string) {
  const { supabase, tenant_id } = await getUserContext();
  const { error } = await supabase.from("categorias_config")
    .delete().eq("id", id).eq("tenant_id", tenant_id).eq("modulo", "optometristas");
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracion");
  return { success: true };
}
