"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

/* ── Fetch Product Catalog ───────────────────────────────── */
export interface CatalogItem {
  id: string;
  tipo: string;
  label: string;
  precio: number;
  stock: number | null;
  maneja_stock: boolean;
}

export async function obtenerCatalogo(): Promise<CatalogItem[]> {
  const { supabase, tenant_id, sucursal_id } = await getUserContext();

  const { data: productos } = await supabase
    .from("productos")
    .select("id, categoria, nombre, marca, modelo, color, precio, stock, maneja_stock")
    .eq("tenant_id", tenant_id)
    .eq("activo", true)
    .or(`sucursal_id.eq.${sucursal_id},sucursal_id.is.null`)
    .order("categoria")
    .order("nombre")
    .order("marca");

  const items: CatalogItem[] = [];

  // Normalizar categorías de aro al tipo canónico "aro" para la validación de orden
  const normalizarTipo = (categoria: string): string => {
    if (categoria.startsWith("aro")) return "aro";
    return categoria;
  };

  (productos ?? []).forEach((p) => {
    let label = "";
    if (p.categoria.includes("aro") || p.categoria === "accesorio") {
      const parts = [p.nombre, p.marca, p.modelo, p.color].filter(Boolean);
      label = parts.join(" — ");
    } else {
      label = p.nombre || p.categoria;
    }
    items.push({
      id: p.id,
      tipo: normalizarTipo(p.categoria),
      label,
      precio: Number(p.precio),
      stock: p.stock,
      maneja_stock: p.maneja_stock
    });
  });

  return items;
}

/* ── Create Proforma ────────────────────────────────────── */
export async function crearProforma(formData: FormData) {
  const { supabase, userId, tenant_id, sucursal_id } = await getUserContext();

  const paciente_id = formData.get("paciente_id") as string;
  const examen_id = (formData.get("examen_id") as string) || null;
  const campana_id = (formData.get("campana_id") as string) || null;
  const notas = (formData.get("notas") as string)?.trim() || null;
  const descuento = parseFloat(formData.get("descuento") as string) || 0;
  const idempotency_key = formData.get("idempotency_key") as string;

  if (!paciente_id) {
    return redirect("/dashboard/ventas/nueva?error=Selecciona+un+paciente");
  }

  // Parse line items from JSON hidden field
  const TIPOS_PRODUCTO_VALIDOS = ["aro", "lente", "tratamiento", "accesorio", "servicio", "otro"];
  let items: { producto_id: string | null; tipo_producto: string; descripcion: string; cantidad: number; precio_unitario: number }[] = [];
  const itemsRaw = formData.get("items_json") as string;
  try {
    const parsed = JSON.parse(itemsRaw);
    items = Array.isArray(parsed) ? parsed : [];
  } catch { /* empty */ }

  if (items.length === 0) {
    return redirect("/dashboard/ventas/nueva?error=Agrega+al+menos+un+producto");
  }

  // Validar tipos de producto
  if (items.some(it => !TIPOS_PRODUCTO_VALIDOS.includes(it.tipo_producto))) {
    return redirect("/dashboard/ventas/nueva?error=Tipo+de+producto+inválido");
  }

  // Calculate totals
  const subtotal = items.reduce((sum, it) => sum + it.cantidad * it.precio_unitario, 0);
  if (isNaN(descuento) || descuento < 0 || descuento > subtotal) {
    return redirect("/dashboard/ventas/nueva?error=Descuento+inválido");
  }
  const total = Math.max(subtotal - descuento, 0);

  // Validar items
  const itemsValidos = items.filter(it => it.cantidad > 0 && it.precio_unitario >= 0);
  if (itemsValidos.length === 0) {
    return redirect("/dashboard/ventas/nueva?error=Items+con+cantidad+o+precio+invalido");
  }

  // Check idempotency (scoped al tenant para evitar cross-tenant leaks)
  const { data: existing } = await supabase
    .from("ordenes")
    .select("id")
    .eq("idempotency_key", idempotency_key)
    .eq("tenant_id", tenant_id)
    .maybeSingle();

  if (existing) {
    redirect(`/dashboard/ventas/${existing.id}`);
  }

  // Insert order
  const { data: orden, error: ordenError } = await supabase
    .from("ordenes")
    .insert({
      tenant_id,
      sucursal_id,
      paciente_id,
      examen_id,
      campana_id,
      asesor_id: userId,
      idempotency_key,
      tipo: "proforma",
      estado: "borrador",
      subtotal,
      descuento,
      total,
      notas,
    })
    .select("id")
    .single();

  if (ordenError || !orden) {
    return redirect("/dashboard/ventas/nueva?error=" + encodeURIComponent(ordenError?.message || "Error al crear"));
  }

  // Insert line items
  const detalles = items.map((it) => ({
    orden_id: orden.id,
    producto_id: it.producto_id,
    tipo_producto: it.tipo_producto,
    descripcion: it.descripcion,
    cantidad: it.cantidad,
    precio_unitario: it.precio_unitario,
    subtotal: it.cantidad * it.precio_unitario,
  }));

  await supabase.from("orden_detalle").insert(detalles);

  revalidatePath("/dashboard/ventas");
  if (campana_id) revalidatePath(`/dashboard/campanas/${campana_id}`);
  redirect(`/dashboard/ventas/${orden.id}`);
}

const ORDEN_ESTADOS_VALIDOS = ["borrador", "confirmada", "facturada", "cancelada"] as const;

/* ── Update Status ──────────────────────────────────────── */
export async function actualizarEstado(ordenId: string, nuevoEstado: string) {
  if (!(ORDEN_ESTADOS_VALIDOS as readonly string[]).includes(nuevoEstado)) {
    throw new Error("Estado de orden inválido");
  }
  const { supabase, tenant_id } = await getUserContext();

  const { data: orden } = await supabase
    .from("ordenes").select("campana_id").eq("id", ordenId).eq("tenant_id", tenant_id).single();

  const { error } = await supabase
    .from("ordenes")
    .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
    .eq("id", ordenId)
    .eq("tenant_id", tenant_id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/ventas");
  revalidatePath(`/dashboard/ventas/${ordenId}`);
  if (orden?.campana_id) revalidatePath(`/dashboard/campanas/${orden.campana_id}`);
}

/* ── Convert Proforma → Orden de Trabajo ────────────────── */
export async function convertirAOrden(ordenId: string) {
  const { supabase, tenant_id } = await getUserContext();

  // 1. Fetch line items to check stock
  const { data: items } = await supabase
    .from("orden_detalle")
    .select("producto_id, cantidad")
    .eq("orden_id", ordenId);

  if (items && items.length > 0) {
    for (const item of items) {
      if (item.producto_id) {
        // Fetch product to see if it manages stock
        const { data: prod } = await supabase
          .from("productos")
          .select("maneja_stock, stock")
          .eq("id", item.producto_id)
          .eq("tenant_id", tenant_id)
          .single();

        if (prod?.maneja_stock) {
          const nuevoStock = (prod.stock || 0) - (item.cantidad || 0);
          await supabase
            .from("productos")
            .update({ stock: nuevoStock })
            .eq("id", item.producto_id)
            .eq("tenant_id", tenant_id);
        }
      }
    }
  }

  // 2. Update order type and status
  const { error } = await supabase
    .from("ordenes")
    .update({
      tipo: "orden_trabajo",
      estado: "confirmada",
      updated_at: new Date().toISOString()
    })
    .eq("id", ordenId)
    .eq("tenant_id", tenant_id);

  if (error) throw new Error(error.message);

  // 3. Create initial lab status
  await supabase.from("laboratorio_estados").insert({
    orden_id: ordenId,
    tenant_id,
    estado: "pendiente",
  });

  // 4. Fetch campana_id to revalidate campaign dashboard
  const { data: ordenData } = await supabase
    .from("ordenes").select("campana_id").eq("id", ordenId).eq("tenant_id", tenant_id).single();

  revalidatePath("/dashboard/ventas");
  revalidatePath(`/dashboard/ventas/${ordenId}`);
  revalidatePath("/dashboard/laboratorio");
  if (ordenData?.campana_id) revalidatePath(`/dashboard/campanas/${ordenData.campana_id}`);
}

/* ── Anular Orden (Restituye Stock) ─────────────────────── */
export async function anularOrden(ordenId: string) {
  const { supabase, tenant_id } = await getUserContext();

  // 1. Check current status (verificar que la orden pertenece al tenant)
  const { data: orden } = await supabase
    .from("ordenes")
    .select("estado, tipo, campana_id")
    .eq("id", ordenId)
    .eq("tenant_id", tenant_id)
    .single();

  if (!orden || orden.estado === "anulada") return;

  // 2. Restitute stock if it was an "orden_trabajo" (because stock was deducted upon conversion)
  // or if it was a proforma that somehow already had stock deducted (though currently we deduct on conversion)
  if (orden.tipo === "orden_trabajo") {
    const { data: items } = await supabase
      .from("orden_detalle")
      .select("producto_id, cantidad")
      .eq("orden_id", ordenId);

    if (items && items.length > 0) {
      for (const item of items) {
        if (item.producto_id) {
          const { data: prod } = await supabase
            .from("productos")
            .select("maneja_stock, stock")
            .eq("id", item.producto_id)
            .eq("tenant_id", tenant_id)
            .single();

          if (prod?.maneja_stock) {
            const nuevoStock = (prod.stock || 0) + (item.cantidad || 0);
            await supabase
              .from("productos")
              .update({ stock: nuevoStock })
              .eq("id", item.producto_id)
              .eq("tenant_id", tenant_id);
          }
        }
      }
    }
  }

  // 3. Update status to "anulada"
  const { error } = await supabase
    .from("ordenes")
    .update({
      estado: "anulada",
      updated_at: new Date().toISOString()
    })
    .eq("id", ordenId)
    .eq("tenant_id", tenant_id);

  if (error) throw new Error(error.message);

  // 4. Delete from Kanban (laboratorio_estados)
  await supabase.from("laboratorio_estados").delete()
    .eq("orden_id", ordenId)
    .eq("tenant_id", tenant_id);

  revalidatePath("/dashboard/ventas");
  revalidatePath(`/dashboard/ventas/${ordenId}`);
  revalidatePath("/dashboard/laboratorio");
  if (orden.campana_id) revalidatePath(`/dashboard/campanas/${orden.campana_id}`);
}

/* ── Get Order Details ──────────────────────────────────── */
export async function obtenerOrden(ordenId: string) {
  const { supabase, tenant_id } = await getUserContext();

  const { data: orden } = await supabase
    .from("ordenes")
    .select("*, paciente:pacientes!ordenes_paciente_id_fkey(nombre, telefono, email), asesor:usuarios!ordenes_asesor_id_fkey(nombre)")
    .eq("id", ordenId)
    .eq("tenant_id", tenant_id)
    .single();

  if (!orden) return null;

  const { data: detalles } = await supabase
    .from("orden_detalle")
    .select("*")
    .eq("orden_id", ordenId)
    .order("created_at", { ascending: true });

  const { data: labEstado } = await supabase
    .from("laboratorio_estados")
    .select("*")
    .eq("orden_id", ordenId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { orden, detalles: detalles ?? [], labEstado };
}

/* ── List Orders ────────────────────────────────────────── */
export async function listarOrdenes(filtroTipo?: string) {
  const { supabase, tenant_id, sucursal_id } = await getUserContext();

  let query = supabase
    .from("ordenes")
    .select("*, paciente:pacientes!ordenes_paciente_id_fkey(nombre), asesor:usuarios!ordenes_asesor_id_fkey(nombre)")
    .eq("tenant_id", tenant_id)
    .eq("sucursal_id", sucursal_id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (filtroTipo === "proforma") query = query.eq("tipo", "proforma");
  if (filtroTipo === "orden_trabajo") query = query.eq("tipo", "orden_trabajo");

  const { data } = await query;
  return data ?? [];
}

/* ── Get Ticket Data ────────────────────────────────────── */
export async function obtenerDatosTicket(ordenId: string) {
  const { supabase, tenant_id, sucursal_id } = await getUserContext();

  const { data: orden } = await supabase
    .from("ordenes")
    .select("*, paciente:pacientes!ordenes_paciente_id_fkey(nombre, telefono), asesor:usuarios!ordenes_asesor_id_fkey(nombre)")
    .eq("id", ordenId)
    .eq("tenant_id", tenant_id)
    .single();

  if (!orden) return null;

  const { data: detalles } = await supabase
    .from("orden_detalle")
    .select("tipo_producto, descripcion, cantidad, precio_unitario, subtotal")
    .eq("orden_id", ordenId)
    .order("created_at", { ascending: true });

  const { data: empresa } = await supabase
    .from("empresas")
    .select("nombre, nit, logo_url, email")
    .eq("id", tenant_id)
    .single();

  const { data: sucursal } = await supabase
    .from("sucursales")
    .select("nombre, direccion, telefono")
    .eq("id", sucursal_id)
    .single();

  // Fetch pagos for ticket
  const { data: pagos } = await supabase
    .from("pagos")
    .select("monto, metodo_pago, created_at")
    .eq("orden_id", ordenId)
    .eq("tenant_id", tenant_id)
    .order("created_at", { ascending: true });

  const totalAbonado = (pagos ?? []).reduce((s, p) => s + Number(p.monto), 0);

  return {
    orden,
    detalles: detalles ?? [],
    empresa,
    sucursal,
    pagos: pagos ?? [],
    totalAbonado,
    saldoPendiente: Number(orden.total) - totalAbonado,
  };
}

/* ── Register Payment / Abono ───────────────────────────── */
export async function registrarPago(ordenId: string, monto: number, metodoPago: string, referencia?: string, notas?: string) {
  const { supabase, tenant_id } = await getUserContext();

  if (monto <= 0) throw new Error("El monto debe ser mayor a 0");

  // Server-side: check balance before allowing payment
  const { data: orden } = await supabase
    .from("ordenes")
    .select("total")
    .eq("id", ordenId)
    .eq("tenant_id", tenant_id)
    .single();

  if (!orden) throw new Error("Orden no encontrada");

  const { data: pagosExistentes } = await supabase
    .from("pagos")
    .select("monto")
    .eq("orden_id", ordenId)
    .eq("tenant_id", tenant_id);

  const totalAbonado = (pagosExistentes ?? []).reduce((s, p) => s + Number(p.monto), 0);
  const saldo = Number(orden.total) - totalAbonado;

  if (monto > saldo + 0.01) {
    throw new Error(`El monto ($${monto.toFixed(2)}) excede el saldo pendiente ($${saldo.toFixed(2)})`);
  }

  const { error } = await supabase.from("pagos").insert({
    orden_id: ordenId,
    tenant_id,
    monto,
    metodo_pago: metodoPago,
    referencia: referencia?.trim() || null,
    notas: notas?.trim() || null,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/ventas/${ordenId}`);
  revalidatePath("/dashboard/ventas");
}

/* ── Get Payments for an Order ──────────────────────────── */
export async function obtenerPagos(ordenId: string) {
  const { supabase, tenant_id } = await getUserContext();

  const { data: pagos } = await supabase
    .from("pagos")
    .select("*")
    .eq("orden_id", ordenId)
    .eq("tenant_id", tenant_id)
    .order("created_at", { ascending: true });

  return pagos ?? [];
}
