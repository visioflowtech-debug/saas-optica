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
  id: string | null;       // null = predeterminada (hardcoded)
  valor: string;
  label: string;
  activo: boolean;
  esPredeterminada: boolean;
}

export async function obtenerCategoriasGasto(): Promise<CategoriaItem[]> {
  const { supabase, tenant_id } = await getUserContext();
  const { data: custom } = await supabase
    .from("categorias_config")
    .select("id, valor, label, activo")
    .eq("tenant_id", tenant_id)
    .eq("modulo", "gastos")
    .order("label");

  // Predeterminadas del sistema (hardcoded)
  const predeterminadas: CategoriaItem[] = CATEGORIAS_GASTO.map((c) => ({
    id: null,
    valor: c.value,
    label: c.label,
    activo: true,
    esPredeterminada: true,
  }));

  // Personalizadas del tenant
  const personalizadas: CategoriaItem[] = (custom || []).map((c) => ({
    id: c.id,
    valor: c.valor,
    label: c.label,
    activo: c.activo,
    esPredeterminada: false,
  }));

  return [...predeterminadas, ...personalizadas];
}

export async function crearCategoriaGasto(label: string) {
  const { supabase, tenant_id } = await getUserContext();
  const valor = label.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!valor || !label.trim()) return { error: "Nombre inválido" };
  const { error } = await supabase.from("categorias_config").insert({
    tenant_id,
    modulo: "gastos",
    valor,
    label: label.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard/gastos");
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
