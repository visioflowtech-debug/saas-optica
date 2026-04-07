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

export async function obtenerLaboratorios() {
  const { supabase, tenant_id } = await getUserContext();
  const { data } = await supabase
    .from("laboratorios")
    .select("id, nombre, contacto, telefono, email, activo")
    .eq("tenant_id", tenant_id)
    .order("nombre");
  return data || [];
}

export async function crearLaboratorio(formData: FormData) {
  const { supabase, tenant_id } = await getUserContext();
  const nombre   = (formData.get("nombre") as string)?.trim();
  const contacto = (formData.get("contacto") as string)?.trim() || null;
  const telefono = (formData.get("telefono") as string)?.trim() || null;
  const email    = (formData.get("email") as string)?.trim() || null;
  if (!nombre) return { error: "El nombre es requerido" };
  const { error } = await supabase.from("laboratorios")
    .insert({ tenant_id, nombre, contacto, telefono, email });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

export async function actualizarLaboratorio(
  id: string,
  payload: { nombre: string; contacto?: string; telefono?: string; email?: string }
) {
  const { supabase, tenant_id } = await getUserContext();
  const { error } = await supabase.from("laboratorios")
    .update({
      nombre: payload.nombre,
      contacto: payload.contacto,
      telefono: payload.telefono,
      email: payload.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id).eq("tenant_id", tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

export async function toggleLaboratorioActivo(id: string, activo: boolean) {
  const { supabase, tenant_id } = await getUserContext();
  const { error } = await supabase.from("laboratorios")
    .update({ activo, updated_at: new Date().toISOString() })
    .eq("id", id).eq("tenant_id", tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

export async function eliminarLaboratorio(id: string) {
  const { supabase, tenant_id } = await getUserContext();
  // Desvincular órdenes antes de borrar
  await supabase.from("orden_laboratorio_datos")
    .update({ laboratorio_id: null }).eq("laboratorio_id", id).eq("tenant_id", tenant_id);
  const { error } = await supabase.from("laboratorios")
    .delete().eq("id", id).eq("tenant_id", tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracion");
  return { success: true };
}
