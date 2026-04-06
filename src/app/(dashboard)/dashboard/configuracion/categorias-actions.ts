"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CATEGORIAS_GASTO } from "../gastos/types";

async function getUserContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: perfil } = await supabase
    .from("usuarios").select("tenant_id, rol").eq("id", user.id).single();
  if (!perfil) throw new Error("Perfil no encontrado");
  return { supabase, ...perfil };
}

export interface CategoriaItem {
  id: string | null;
  valor: string;
  label: string;
  activo: boolean;
  esPredeterminada: boolean;
  zoho_account_id: string | null;
}

export async function obtenerCategoriasGasto(): Promise<CategoriaItem[]> {
  const { supabase, tenant_id } = await getUserContext();
  const { data: custom } = await supabase
    .from("categorias_config")
    .select("id, valor, label, activo, zoho_account_id")
    .eq("tenant_id", tenant_id)
    .eq("modulo", "gastos")
    .order("label");

  const predeterminadas: CategoriaItem[] = CATEGORIAS_GASTO.map((c) => ({
    id: null, valor: c.value, label: c.label, activo: true, esPredeterminada: true, zoho_account_id: null,
  }));

  const personalizadas: CategoriaItem[] = (custom || []).map((c) => ({
    id: c.id, valor: c.valor, label: c.label, activo: c.activo,
    esPredeterminada: false, zoho_account_id: c.zoho_account_id ?? null,
  }));

  return [...predeterminadas, ...personalizadas];
}

export async function crearCategoriaGasto(label: string, zohoAccountId?: string) {
  const { supabase, tenant_id } = await getUserContext();
  const valor = label.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!valor || !label.trim()) return { error: "Nombre inválido" };
  const { error } = await supabase.from("categorias_config").insert({
    tenant_id,
    modulo: "gastos",
    valor,
    label: label.trim(),
    zoho_account_id: zohoAccountId?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard/gastos");
  return { success: true };
}

export async function actualizarZohoAccountId(id: string, zohoAccountId: string) {
  const { supabase, tenant_id } = await getUserContext();
  const { error } = await supabase.from("categorias_config")
    .update({ zoho_account_id: zohoAccountId.trim() || null })
    .eq("id", id).eq("tenant_id", tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

export async function toggleCategoriaGasto(id: string, activo: boolean) {
  const { supabase, tenant_id } = await getUserContext();
  const { error } = await supabase.from("categorias_config")
    .update({ activo }).eq("id", id).eq("tenant_id", tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

export async function eliminarCategoriaGasto(id: string) {
  const { supabase, tenant_id } = await getUserContext();
  const { error } = await supabase.from("categorias_config")
    .delete().eq("id", id).eq("tenant_id", tenant_id).eq("modulo", "gastos");
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard/gastos");
  return { success: true };
}
