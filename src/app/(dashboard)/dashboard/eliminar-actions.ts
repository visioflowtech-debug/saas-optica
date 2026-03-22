"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function getUserContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: perfil } = await supabase
    .from("usuarios").select("tenant_id, sucursal_id, rol").eq("id", user.id).single();
  if (!perfil) throw new Error("Perfil no encontrado");
  return { supabase, userId: user.id, ...perfil };
}

/* ─────────────────────────────────────────────────────────────
   ELIMINAR ORDEN (con toda su jerarquía)
   Orden: laboratorio_estados → pagos → orden_laboratorio_datos
          → orden_detalle → ordenes (+ restaurar stock si aplica)
───────────────────────────────────────────────────────────── */
export async function eliminarOrdenCompleta(ordenId: string) {
  const { supabase, tenant_id } = await getUserContext();

  // Verificar que la orden pertenece al tenant
  const { data: orden } = await supabase
    .from("ordenes").select("id, tipo, estado, campana_id, paciente_id")
    .eq("id", ordenId).eq("tenant_id", tenant_id).single();
  if (!orden) return { error: "Orden no encontrada" };

  // Restaurar stock si era orden_trabajo confirmada
  if (orden.tipo === "orden_trabajo" && orden.estado !== "anulada") {
    const { data: items } = await supabase
      .from("orden_detalle").select("producto_id, cantidad").eq("orden_id", ordenId);
    for (const item of items ?? []) {
      if (!item.producto_id) continue;
      const { data: prod } = await supabase
        .from("productos").select("maneja_stock, stock").eq("id", item.producto_id).single();
      if (prod?.maneja_stock) {
        await supabase.from("productos")
          .update({ stock: (prod.stock || 0) + (item.cantidad || 0) })
          .eq("id", item.producto_id);
      }
    }
  }

  // Eliminar en orden correcto
  await supabase.from("laboratorio_estados").delete().eq("orden_id", ordenId);
  await supabase.from("pagos").delete().eq("orden_id", ordenId);
  await supabase.from("orden_laboratorio_datos").delete().eq("orden_id", ordenId);
  await supabase.from("orden_detalle").delete().eq("orden_id", ordenId);
  const { error } = await supabase.from("ordenes").delete().eq("id", ordenId).eq("tenant_id", tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/ventas");
  revalidatePath("/dashboard/laboratorio");
  if (orden.campana_id) revalidatePath(`/dashboard/campanas/${orden.campana_id}`);
  if (orden.paciente_id) revalidatePath(`/dashboard/pacientes/${orden.paciente_id}`);

  return { success: true, redirectTo: "/dashboard/ventas" };
}

/* ─────────────────────────────────────────────────────────────
   ELIMINAR EXAMEN CLÍNICO
   Primero desvincula el examen de cualquier orden (examen_id → null)
   luego elimina el examen.
───────────────────────────────────────────────────────────── */
export async function eliminarExamen(examenId: string) {
  const { supabase, tenant_id } = await getUserContext();

  const { data: examen } = await supabase
    .from("examenes_clinicos").select("id, paciente_id, campana_id")
    .eq("id", examenId).eq("tenant_id", tenant_id).single();
  if (!examen) return { error: "Examen no encontrado" };

  // Desvincular de órdenes que lo referencian
  await supabase.from("ordenes")
    .update({ examen_id: null }).eq("examen_id", examenId);

  const { error } = await supabase.from("examenes_clinicos")
    .delete().eq("id", examenId).eq("tenant_id", tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/examenes");
  revalidatePath(`/dashboard/pacientes/${examen.paciente_id}`);
  if (examen.campana_id) revalidatePath(`/dashboard/campanas/${examen.campana_id}`);

  return { success: true, redirectTo: `/dashboard/pacientes/${examen.paciente_id}` };
}

/* ─────────────────────────────────────────────────────────────
   ELIMINAR PACIENTE (con toda su jerarquía)
   Orden: laboratorio_estados → pagos → orden_laboratorio_datos
          → orden_detalle → ordenes → examenes_clinicos → paciente
───────────────────────────────────────────────────────────── */
export async function eliminarPaciente(pacienteId: string) {
  const { supabase, tenant_id } = await getUserContext();

  const { data: paciente } = await supabase
    .from("pacientes").select("id, campana_id").eq("id", pacienteId).eq("tenant_id", tenant_id).single();
  if (!paciente) return { error: "Paciente no encontrado" };

  // Obtener todas las órdenes del paciente
  const { data: ordenes } = await supabase
    .from("ordenes").select("id").eq("paciente_id", pacienteId).eq("tenant_id", tenant_id);

  const ordenIds = (ordenes ?? []).map((o) => o.id);

  if (ordenIds.length > 0) {
    // Restaurar stock en órdenes de trabajo
    const { data: ordenesData } = await supabase
      .from("ordenes").select("id, tipo, estado").in("id", ordenIds);
    for (const o of ordenesData ?? []) {
      if (o.tipo === "orden_trabajo" && o.estado !== "anulada") {
        const { data: items } = await supabase
          .from("orden_detalle").select("producto_id, cantidad").eq("orden_id", o.id);
        for (const item of items ?? []) {
          if (!item.producto_id) continue;
          const { data: prod } = await supabase
            .from("productos").select("maneja_stock, stock").eq("id", item.producto_id).single();
          if (prod?.maneja_stock) {
            await supabase.from("productos")
              .update({ stock: (prod.stock || 0) + (item.cantidad || 0) })
              .eq("id", item.producto_id);
          }
        }
      }
    }
    await supabase.from("laboratorio_estados").delete().in("orden_id", ordenIds);
    await supabase.from("pagos").delete().in("orden_id", ordenIds);
    await supabase.from("orden_laboratorio_datos").delete().in("orden_id", ordenIds);
    await supabase.from("orden_detalle").delete().in("orden_id", ordenIds);
    await supabase.from("ordenes").delete().in("id", ordenIds);
  }

  // Eliminar exámenes
  await supabase.from("examenes_clinicos").delete().eq("paciente_id", pacienteId);

  // Eliminar paciente
  const { error } = await supabase.from("pacientes")
    .delete().eq("id", pacienteId).eq("tenant_id", tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/pacientes");
  revalidatePath("/dashboard/ventas");
  if (paciente.campana_id) revalidatePath(`/dashboard/campanas/${paciente.campana_id}`);

  return { success: true, redirectTo: "/dashboard/pacientes" };
}

/* ─────────────────────────────────────────────────────────────
   EDITAR GASTO
───────────────────────────────────────────────────────────── */
export async function editarGasto(
  id: string,
  payload: { concepto: string; categoria: string; monto: number; fecha: string; notas?: string }
) {
  const { supabase, tenant_id } = await getUserContext();

  const { data: gasto } = await supabase
    .from("gastos").select("campana_id").eq("id", id).eq("tenant_id", tenant_id).single();

  const { error } = await supabase.from("gastos")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id).eq("tenant_id", tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/gastos");
  if (gasto?.campana_id) revalidatePath(`/dashboard/campanas/${gasto.campana_id}`);
  return { success: true };
}
