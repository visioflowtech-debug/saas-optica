"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function obtenerConfiguracion() {
  const supabase = await createClient();

  // The RLS policy will automatically scope these to the user's tenant_id
  const { data: empresa, error: empresaError } = await supabase
    .from("empresas")
    .select("*")
    .limit(1)
    .single();

  if (empresaError && empresaError.code !== "PGRST116") {
    // PGRST116 is "no rows found", meaning they don't have an active tenant row they can see.
    console.error("Error fetching empresa:", empresaError);
    return { empresa: null, sucursales: [], error: empresaError.message };
  }

  const { data: sucursales, error: sucursalError } = await supabase
    .from("sucursales")
    .select("id, nombre, direccion, telefono, activa, campanas_activas, created_at, updated_at")
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

export async function actualizarEmpresa(id: string, payload: { nombre: string; nit: string; logo_url: string; email: string }) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("empresas")
    .update({
      nombre: payload.nombre,
      nit: payload.nit,
      logo_url: payload.logo_url,
      email: payload.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating empresa:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

export async function actualizarSucursal(id: string, payload: { nombre: string; direccion: string; telefono: string }) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("sucursales")
    .update({
      nombre: payload.nombre,
      direccion: payload.direccion,
      telefono: payload.telefono,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating sucursal:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

export async function toggleCampanasActivas(sucursalId: string, activas: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("sucursales")
    .update({ campanas_activas: activas, updated_at: new Date().toISOString() })
    .eq("id", sucursalId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/configuracion");
  revalidatePath("/", "layout");
  return { success: true };
}
