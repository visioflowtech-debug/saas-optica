"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Gasto } from "./types";

async function getUserContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("tenant_id, sucursal_id, rol, sucursal:sucursales(items_por_pagina)")
    .eq("id", user.id)
    .single();

  if (!perfil) throw new Error("Perfil no encontrado");
  const sucursalCfg = Array.isArray(perfil.sucursal) ? perfil.sucursal[0] : perfil.sucursal;
  const PAGE_SIZE = Math.max(5, (sucursalCfg as any)?.items_por_pagina ?? 25);
  return { supabase, userId: user.id, PAGE_SIZE, ...perfil };
}

export async function obtenerGastos(filters?: {
  campana_id?: string;
  categoria?: string;
  desde?: string;
  hasta?: string;
  pagina?: number;
}): Promise<{ gastos: Gasto[]; totalMonto: number; porCategoria: Record<string, number>; total: number }> {
  const { supabase, tenant_id, sucursal_id, PAGE_SIZE } = await getUserContext();

  const pagina = filters?.pagina ?? 1;
  const from   = (pagina - 1) * PAGE_SIZE;
  const to     = from + PAGE_SIZE - 1;

  // Lista paginada
  let listQuery = supabase
    .from("gastos")
    .select("*, campana:campanas(nombre)", { count: "exact" })
    .eq("tenant_id", tenant_id)
    .eq("sucursal_id", sucursal_id)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  // Agregación (todos los registros filtrados para KPIs correctos)
  let aggQuery = supabase
    .from("gastos")
    .select("monto, categoria")
    .eq("tenant_id", tenant_id)
    .eq("sucursal_id", sucursal_id);

  if (filters?.campana_id) { listQuery = listQuery.eq("campana_id", filters.campana_id); aggQuery = aggQuery.eq("campana_id", filters.campana_id); }
  if (filters?.categoria)  { listQuery = listQuery.eq("categoria", filters.categoria);   aggQuery = aggQuery.eq("categoria", filters.categoria); }
  if (filters?.desde)      { listQuery = listQuery.gte("fecha", filters.desde);           aggQuery = aggQuery.gte("fecha", filters.desde); }
  if (filters?.hasta)      { listQuery = listQuery.lte("fecha", filters.hasta);           aggQuery = aggQuery.lte("fecha", filters.hasta); }

  const [listResult, aggResult] = await Promise.all([listQuery, aggQuery]);

  const gastos = (listResult.data || []) as Gasto[];
  const todos  = aggResult.data || [];

  const totalMonto = todos.reduce((sum: number, g: { monto: number }) => sum + Number(g.monto), 0);
  const porCategoria: Record<string, number> = {};
  todos.forEach((g: { monto: number; categoria: string }) => {
    porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + Number(g.monto);
  });

  return { gastos, totalMonto, porCategoria, total: listResult.count ?? 0 };
}

export async function registrarGasto(formData: FormData) {
  const { supabase, tenant_id, sucursal_id, userId } = await getUserContext();

  const concepto   = (formData.get("concepto") as string)?.trim();
  const categoria  = formData.get("categoria") as string;
  const monto      = parseFloat(formData.get("monto") as string);
  const fecha      = formData.get("fecha") as string;
  const notas      = (formData.get("notas") as string)?.trim() || null;
  const campana_id = (formData.get("campana_id") as string) || null;

  const CATEGORIAS_VALIDAS = ["transporte", "hospedaje", "alimentacion", "publicidad", "operativo", "otro"];
  if (!concepto || !categoria || isNaN(monto) || monto <= 0) {
    return redirect("/dashboard/gastos/nuevo?error=Datos+incompletos+o+monto+invalido");
  }
  if (!CATEGORIAS_VALIDAS.includes(categoria)) {
    return redirect("/dashboard/gastos/nuevo?error=Categoría+inválida");
  }

  const { error } = await supabase.from("gastos").insert({
    tenant_id,
    sucursal_id,
    campana_id,
    registrado_por: userId,
    concepto,
    categoria,
    monto,
    fecha: fecha || new Date().toISOString().split("T")[0],
    notas,
  });

  if (error) return redirect("/dashboard/gastos/nuevo?error=" + encodeURIComponent(error.message));

  revalidatePath("/dashboard/gastos");
  if (campana_id) revalidatePath(`/dashboard/campanas/${campana_id}`);
  redirect("/dashboard/gastos");
}

export async function eliminarGasto(id: string) {
  const { supabase, tenant_id } = await getUserContext();

  const { data: gasto } = await supabase
    .from("gastos")
    .select("campana_id")
    .eq("id", id)
    .eq("tenant_id", tenant_id)
    .single();

  const { error } = await supabase
    .from("gastos")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/gastos");
  if (gasto?.campana_id) revalidatePath(`/dashboard/campanas/${gasto.campana_id}`);
  return { success: true };
}
