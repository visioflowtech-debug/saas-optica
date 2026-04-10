"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerOCrearContactoZoho, crearFacturaZoho, registrarPagoZoho, crearItemZoho, buildZohoItemName, buildZohoProductType } from "@/lib/zoho-books";
import type { ZohoPaymentMode } from "@/lib/zoho-books";
import { registrarMovimientoCuenta, registrarMovimientoCuentaPorId, tipoCuentaDesdeMetodoPago } from "@/lib/cuentas";

function mapMetodoPago(metodo: string): ZohoPaymentMode {
  const m = metodo.toLowerCase();
  if (m === "efectivo") return "cash";
  if (m === "tarjeta" || m === "tarjeta_credito" || m === "tarjeta_debito") return "creditcard";
  if (m === "transferencia" || m === "deposito") return "banktransfer";
  if (m === "cheque") return "check";
  return "others";
}

async function getUserContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("tenant_id, sucursal_id, rol, sucursal:sucursales(zoho_sync_enabled)")
    .eq("id", user.id)
    .single();

  if (!perfil) throw new Error("Perfil no encontrado");
  const sucursalCfg = Array.isArray(perfil.sucursal) ? perfil.sucursal[0] : perfil.sucursal;
  const zohoEnabled = (sucursalCfg as any)?.zoho_sync_enabled === true;
  return { supabase, userId: user.id, zohoEnabled, ...perfil };
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

  // Todos los items deben tener un producto del catálogo
  if (items.some(it => !it.producto_id)) {
    return redirect("/dashboard/ventas/nueva?error=Selecciona+todos+los+productos+del+catálogo");
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
    tenant_id,
    producto_id: it.producto_id,
    tipo_producto: it.tipo_producto,
    descripcion: it.descripcion,
    cantidad: it.cantidad,
    precio_unitario: it.precio_unitario,
    subtotal: it.cantidad * it.precio_unitario,
  }));

  const { error: detallesError } = await supabase.from("orden_detalle").insert(detalles);
  if (detallesError) {
    // Revertir la orden si no se pudieron insertar los detalles
    await supabase.from("ordenes").delete().eq("id", orden.id);
    return redirect("/dashboard/ventas/nueva?error=" + encodeURIComponent("Error al guardar productos: " + detallesError.message));
  }

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
  const { supabase, tenant_id, zohoEnabled } = await getUserContext();

  const { data: orden } = await supabase
    .from("ordenes").select("campana_id").eq("id", ordenId).eq("tenant_id", tenant_id).single();

  const { error } = await supabase
    .from("ordenes")
    .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
    .eq("id", ordenId)
    .eq("tenant_id", tenant_id);

  if (error) throw new Error(error.message);

  // Zoho Books — crear factura al confirmar (best-effort, solo si sync habilitado)
  if (zohoEnabled && nuevoEstado === "confirmada") {
    const { data: ordenConfirmada } = await supabase
      .from("ordenes")
      .select("paciente_id, notas, descuento, zoho_invoice_id, campana_id")
      .eq("id", ordenId)
      .eq("tenant_id", tenant_id)
      .single();
    if (ordenConfirmada && !ordenConfirmada.zoho_invoice_id) {
      await sincronizarFacturaZoho(supabase, ordenId, ordenConfirmada);
    }
  }

  revalidatePath("/dashboard/ventas");
  revalidatePath(`/dashboard/ventas/${ordenId}`);
  if (orden?.campana_id) revalidatePath(`/dashboard/campanas/${orden.campana_id}`);
}

/* ── Convert Proforma → Orden de Trabajo ────────────────── */
export async function convertirAOrden(ordenId: string) {
  const { supabase, tenant_id, zohoEnabled } = await getUserContext();

  // 1. Verificar ownership + idempotencia: la orden debe ser proforma en borrador
  const { data: ordenActual } = await supabase
    .from("ordenes")
    .select("id, tipo, estado")
    .eq("id", ordenId)
    .eq("tenant_id", tenant_id)
    .single();

  if (!ordenActual) throw new Error("Orden no encontrada");
  if (ordenActual.tipo !== "proforma" || ordenActual.estado !== "confirmada") {
    // Idempotente: si ya fue convertida o no está confirmada, no hacer nada
    return;
  }

  // 2. Fetch line items (seguro: ownership verificado en paso 1)
  const { data: items } = await supabase
    .from("orden_detalle")
    .select("producto_id, cantidad")
    .eq("orden_id", ordenId);

  if (items && items.length > 0) {
    const productoIds = items.map(i => i.producto_id).filter(Boolean) as string[];
    if (productoIds.length > 0) {
      const { data: productos } = await supabase
        .from("productos")
        .select("id, maneja_stock, stock")
        .in("id", productoIds)
        .eq("tenant_id", tenant_id);

      if (productos && productos.length > 0) {
        const stockMap = new Map(productos.map(p => [p.id, p]));
        const itemsConStock = items.filter(
          item => item.producto_id && stockMap.get(item.producto_id)?.maneja_stock
        );

        // 2a. Validar stock suficiente ANTES de descontar
        for (const item of itemsConStock) {
          const prod = stockMap.get(item.producto_id!)!;
          if ((prod.stock ?? 0) < (item.cantidad ?? 0)) {
            throw new Error(`Stock insuficiente para el producto ${item.producto_id}`);
          }
        }

        // 2b. Descontar stock atómicamente (evita race conditions)
        await Promise.all(
          itemsConStock.map(item =>
            supabase.rpc("ajustar_stock_atomico", {
              p_producto_id: item.producto_id,
              p_delta: -(item.cantidad ?? 0),
              p_tenant_id: tenant_id,
            })
          )
        );
      }
    }
  }

  // 3. Update order type and status
  const { error } = await supabase
    .from("ordenes")
    .update({
      tipo: "orden_trabajo",
      estado: "confirmada",
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

  // 4. Fetch campana_id + datos para Zoho
  const { data: ordenData } = await supabase
    .from("ordenes")
    .select("campana_id, paciente_id, notas, descuento, zoho_invoice_id")
    .eq("id", ordenId)
    .eq("tenant_id", tenant_id)
    .single();

  // 5. Zoho Books — solo si sync habilitado y aún no tiene factura
  if (zohoEnabled && ordenData && !ordenData.zoho_invoice_id) {
    await sincronizarFacturaZoho(supabase, ordenId, ordenData);
  }

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

  if (!orden || orden.estado === "cancelada") return;

  // 2. Restituir stock atómicamente si fue orden_trabajo (el stock se descontó al convertir)
  if (orden.tipo === "orden_trabajo") {
    const { data: items } = await supabase
      .from("orden_detalle")
      .select("producto_id, cantidad")
      .eq("orden_id", ordenId);

    if (items && items.length > 0) {
      const productoIds = items.map(i => i.producto_id).filter(Boolean) as string[];
      if (productoIds.length > 0) {
        const { data: productos } = await supabase
          .from("productos")
          .select("id, maneja_stock")
          .in("id", productoIds)
          .eq("tenant_id", tenant_id);

        if (productos && productos.length > 0) {
          const stockSet = new Set(
            productos.filter(p => p.maneja_stock).map(p => p.id)
          );
          await Promise.all(
            items
              .filter(item => item.producto_id && stockSet.has(item.producto_id))
              .map(item =>
                supabase.rpc("ajustar_stock_atomico", {
                  p_producto_id: item.producto_id,
                  p_delta: item.cantidad ?? 0,   // positivo = sumar de vuelta
                  p_tenant_id: tenant_id,
                })
              )
          );
        }
      }
    }
  }

  // 3. Update status to "cancelada"
  const { error } = await supabase
    .from("ordenes")
    .update({
      estado: "cancelada",
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
export async function registrarPago(ordenId: string, monto: number, metodoPago: string, referencia?: string, notas?: string, cuentaId?: string) {
  const { supabase, tenant_id, sucursal_id, zohoEnabled } = await getUserContext();

  if (monto <= 0) throw new Error("El monto debe ser mayor a 0");

  // M-3: Whitelist de métodos de pago válidos
  const METODOS_VALIDOS = ["efectivo", "tarjeta", "tarjeta_credito", "tarjeta_debito", "transferencia", "deposito", "cheque", "otros"];
  if (!METODOS_VALIDOS.includes(metodoPago)) throw new Error("Método de pago inválido");

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

  const { data: pago, error } = await supabase.from("pagos").insert({
    orden_id: ordenId,
    tenant_id,
    monto,
    metodo_pago: metodoPago,
    referencia: referencia?.trim() || null,
    notas: notas?.trim() || null,
  }).select("id").single();

  if (error) throw new Error(error.message);

  // Cuentas — registrar ingreso (best-effort)
  try {
    if (cuentaId) {
      await registrarMovimientoCuentaPorId({
        supabase,
        tenant_id,
        sucursal_id,
        cuenta_id: cuentaId,
        tipo_movimiento: "ingreso",
        monto,
        descripcion: `Abono venta — ${metodoPago}`,
        referencia_tipo: "pago",
        referencia_id: pago?.id ?? null,
      });
    } else {
      await registrarMovimientoCuenta({
        supabase,
        tenant_id,
        sucursal_id,
        tipo_cuenta: tipoCuentaDesdeMetodoPago(metodoPago),
        tipo_movimiento: "ingreso",
        monto,
        descripcion: `Abono venta — ${metodoPago}`,
        referencia_tipo: "pago",
        referencia_id: pago?.id ?? null,
      });
    }
  } catch { /* fail-soft */ }

  // Zoho Books — registrar abono (best-effort, solo si sync habilitado)
  if (zohoEnabled) try {
    const { data: ordenZoho } = await supabase
      .from("ordenes")
      .select("zoho_invoice_id, paciente_id")
      .eq("id", ordenId)
      .eq("tenant_id", tenant_id)
      .single();

    if (ordenZoho?.zoho_invoice_id) {
      const { data: paciente } = await supabase
        .from("pacientes")
        .select("zoho_contact_id")
        .eq("id", ordenZoho.paciente_id)
        .single();

      if (paciente?.zoho_contact_id) {
        const fechaStr = new Date().toISOString().split("T")[0];
        const zohoPaymentId = await registrarPagoZoho({
          contact_id: paciente.zoho_contact_id as string,
          invoice_id: ordenZoho.zoho_invoice_id as string,
          amount: monto,
          date: fechaStr,
          payment_mode: mapMetodoPago(metodoPago),
          reference_number: referencia?.trim() || null,
          description: notas?.trim() || null,
        });
        if (pago?.id) {
          await supabase.from("pagos").update({ zoho_payment_id: zohoPaymentId }).eq("id", pago.id);
        }
      }
    }
  } catch (e) {
    console.error("Zoho sync error (registrarPago):", e);
  }

  revalidatePath(`/dashboard/ventas/${ordenId}`);
  revalidatePath("/dashboard/ventas");
}

/* ── Zoho: crear factura al confirmar ───────────────────── */
async function sincronizarFacturaZoho(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  ordenId: string,
  ordenData: { paciente_id?: string | null; notas?: string | null; descuento?: number | null; zoho_invoice_id?: string | null } | null
) {
  if (!ordenData?.paciente_id) return;
  try {
    const { data: paciente } = await supabase
      .from("pacientes")
      .select("nombre, telefono, email, zoho_contact_id")
      .eq("id", ordenData.paciente_id)
      .single();
    if (!paciente) return;

    let contactId = paciente.zoho_contact_id as string | null;
    if (!contactId) {
      contactId = await obtenerOCrearContactoZoho({
        contact_name: paciente.nombre,
        contact_type: "customer",
        email: paciente.email,
        phone: paciente.telefono,
      });
      await supabase.from("pacientes").update({ zoho_contact_id: contactId }).eq("id", ordenData.paciente_id);
    }

    const { data: detalles } = await supabase
      .from("orden_detalle")
      .select("producto_id, descripcion, cantidad, precio_unitario")
      .eq("orden_id", ordenId)
      .order("created_at", { ascending: true });

    const productoIds = (detalles ?? []).map((d) => d.producto_id).filter(Boolean) as string[];
    const { data: productosZoho } = productoIds.length > 0
      ? await supabase
          .from("productos")
          .select("id, zoho_item_id, categoria, nombre, marca, modelo, color, precio")
          .in("id", productoIds)
      : { data: [] };

    const zohoItemMap: Record<string, string> = {};
    for (const p of productosZoho ?? []) {
      if (p.zoho_item_id) {
        zohoItemMap[p.id] = p.zoho_item_id as string;
      } else {
        try {
          const newItemId = await crearItemZoho({
            name: buildZohoItemName(p),
            rate: p.precio,
            product_type: buildZohoProductType(p.categoria),
          });
          await supabase.from("productos").update({ zoho_item_id: newItemId }).eq("id", p.id);
          zohoItemMap[p.id] = newItemId;
        } catch { /* continúa sin item_id */ }
      }
    }

    const fechaStr = new Date().toISOString().split("T")[0];
    const { invoice_id } = await crearFacturaZoho({
      contact_id: contactId,
      date: fechaStr,
      reference_number: ordenId,
      line_items: (detalles ?? []).map((d) => ({
        name: d.descripcion,
        rate: d.precio_unitario,
        quantity: d.cantidad,
        item_id: d.producto_id ? (zohoItemMap[d.producto_id] ?? null) : null,
      })),
      notes: ordenData.notas ?? undefined,
    });
    await supabase.from("ordenes").update({ zoho_invoice_id: invoice_id }).eq("id", ordenId);

    // Retrosinc: pagos que ya existían antes de confirmar
    const { data: pagosExistentes } = await supabase
      .from("pagos")
      .select("id, monto, metodo_pago, referencia, notas, zoho_payment_id")
      .eq("orden_id", ordenId)
      .is("zoho_payment_id", null);

    for (const pago of pagosExistentes ?? []) {
      try {
        const fechaPago = new Date().toISOString().split("T")[0];
        const zohoPaymentId = await registrarPagoZoho({
          contact_id: contactId,
          invoice_id,
          amount: Number(pago.monto),
          date: fechaPago,
          payment_mode: mapMetodoPago(pago.metodo_pago),
          reference_number: pago.referencia ?? null,
          description: pago.notas ?? null,
        });
        await supabase.from("pagos").update({ zoho_payment_id: zohoPaymentId }).eq("id", pago.id);
      } catch { /* best-effort — continúa con el siguiente pago */ }
    }
  } catch (e) {
    console.error("Zoho sync error (confirmar):", e);
  }
}

/* ── Helpers internos ───────────────────────────────────── */
async function verificarProformaBorrador(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  ordenId: string,
  tenant_id: string
) {
  const { data } = await supabase
    .from("ordenes")
    .select("id, subtotal, descuento")
    .eq("id", ordenId)
    .eq("tenant_id", tenant_id)
    .eq("tipo", "proforma")
    .eq("estado", "borrador")
    .single();
  return data;
}

async function recalcularTotalesOrden(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  ordenId: string,
  tenant_id: string,
  descuento: number
) {
  const { data: lineas } = await supabase
    .from("orden_detalle")
    .select("cantidad, precio_unitario")
    .eq("orden_id", ordenId)
    .eq("tenant_id", tenant_id);
  const nuevoSubtotal = (lineas ?? []).reduce((s, l) => s + Number(l.cantidad) * Number(l.precio_unitario), 0);
  const nuevoTotal = Math.max(nuevoSubtotal - descuento, 0);
  await supabase.from("ordenes")
    .update({ subtotal: nuevoSubtotal, total: nuevoTotal, updated_at: new Date().toISOString() })
    .eq("id", ordenId)
    .eq("tenant_id", tenant_id);
  return { subtotal: nuevoSubtotal, total: nuevoTotal };
}

/* ── Agregar línea a proforma en borrador ───────────────── */
export async function agregarLineaProforma(
  ordenId: string,
  line: { producto_id: string; tipo_producto: string; descripcion: string; cantidad: number; precio_unitario: number }
) {
  const { supabase, tenant_id } = await getUserContext();
  const orden = await verificarProformaBorrador(supabase, ordenId, tenant_id);
  if (!orden) return { success: false, error: "Solo se pueden editar proformas en borrador" };

  const TIPOS_VALIDOS = ["aro", "lente", "tratamiento", "accesorio", "servicio", "otro"];
  if (!TIPOS_VALIDOS.includes(line.tipo_producto)) return { success: false, error: "Tipo inválido" };
  if (line.cantidad < 1 || line.precio_unitario < 0) return { success: false, error: "Cantidad o precio inválido" };

  const { error } = await supabase.from("orden_detalle").insert({
    orden_id: ordenId,
    tenant_id,
    producto_id: line.producto_id || null,
    tipo_producto: line.tipo_producto,
    descripcion: line.descripcion,
    cantidad: line.cantidad,
    precio_unitario: line.precio_unitario,
    subtotal: line.cantidad * line.precio_unitario,
  });

  if (error) return { success: false, error: error.message };

  const totales = await recalcularTotalesOrden(supabase, ordenId, tenant_id, Number(orden.descuento));
  revalidatePath(`/dashboard/ventas/${ordenId}`);
  return { success: true, ...totales };
}

/* ── Eliminar línea de proforma en borrador ─────────────── */
export async function eliminarLineaProforma(ordenId: string, lineaId: string) {
  const { supabase, tenant_id } = await getUserContext();
  const orden = await verificarProformaBorrador(supabase, ordenId, tenant_id);
  if (!orden) return { success: false, error: "Solo se pueden editar proformas en borrador" };

  // Verificar que quedan al menos 2 líneas (al eliminar quedará ≥1)
  const { count } = await supabase
    .from("orden_detalle").select("id", { count: "exact", head: true }).eq("orden_id", ordenId);
  if ((count ?? 0) <= 1) return { success: false, error: "La proforma debe tener al menos un producto" };

  await supabase.from("orden_detalle").delete().eq("id", lineaId).eq("orden_id", ordenId).eq("tenant_id", tenant_id);

  const totales = await recalcularTotalesOrden(supabase, ordenId, tenant_id, Number(orden.descuento));
  revalidatePath(`/dashboard/ventas/${ordenId}`);
  return { success: true, ...totales };
}

/* ── Actualizar precio de línea en proforma en borrador ─── */
export async function actualizarPrecioLinea(ordenId: string, lineaId: string, nuevoPrecio: number) {
  const { supabase, tenant_id } = await getUserContext();
  const orden = await verificarProformaBorrador(supabase, ordenId, tenant_id);
  if (!orden) return { success: false, error: "Solo se pueden editar proformas en borrador" };
  if (nuevoPrecio < 0) return { success: false, error: "El precio no puede ser negativo" };

  const { data: linea } = await supabase
    .from("orden_detalle").select("cantidad").eq("id", lineaId).eq("orden_id", ordenId).eq("tenant_id", tenant_id).single();
  if (!linea) return { success: false, error: "Línea no encontrada" };

  const nuevoSubtotal = Number(linea.cantidad) * nuevoPrecio;
  await supabase.from("orden_detalle")
    .update({ precio_unitario: nuevoPrecio, subtotal: nuevoSubtotal })
    .eq("id", lineaId)
    .eq("orden_id", ordenId)
    .eq("tenant_id", tenant_id);

  const totales = await recalcularTotalesOrden(supabase, ordenId, tenant_id, Number(orden.descuento));
  revalidatePath(`/dashboard/ventas/${ordenId}`);
  return { success: true, ...totales };
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
