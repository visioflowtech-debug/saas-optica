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
    .select("tenant_id, sucursal_id, rol")
    .eq("id", user.id)
    .single();

  if (!perfil) throw new Error("Perfil no encontrado");
  return { supabase, userId: user.id, ...perfil };
}

export async function obtenerGastos(filters?: {
  campana_id?: string;
  categoria?: string;
  desde?: string;
  hasta?: string;
}): Promise<{ gastos: Gasto[]; totalMonto: number }> {
  const { supabase, tenant_id, sucursal_id } = await getUserContext();

  let query = supabase
    .from("gastos")
    .select("*, campana:campanas(nombre)")
    .eq("tenant_id", tenant_id)
    .eq("sucursal_id", sucursal_id)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters?.campana_id) query = query.eq("campana_id", filters.campana_id);
  if (filters?.categoria)  query = query.eq("categoria", filters.categoria);
  if (filters?.desde)      query = query.gte("fecha", filters.desde);
  if (filters?.hasta)      query = query.lte("fecha", filters.hasta);

  const { data, error } = await query;
  if (error) return { gastos: [], totalMonto: 0 };

  const gastos = (data || []) as Gasto[];
  const totalMonto = gastos.reduce((sum, g) => sum + Number(g.monto), 0);
  return { gastos, totalMonto };
}

export async function registrarGasto(formData: FormData) {
  const { supabase, tenant_id, sucursal_id, userId } = await getUserContext();

  const concepto   = (formData.get("concepto") as string)?.trim();
  const categoria  = formData.get("categoria") as string;
  const monto      = parseFloat(formData.get("monto") as string);
  const fecha      = formData.get("fecha") as string;
  const notas      = (formData.get("notas") as string)?.trim() || null;
  const campana_id = (formData.get("campana_id") as string) || null;

  if (!concepto || !categoria || isNaN(monto) || monto <= 0) {
    return redirect("/dashboard/gastos/nuevo?error=Datos+incompletos+o+monto+invalido");
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
