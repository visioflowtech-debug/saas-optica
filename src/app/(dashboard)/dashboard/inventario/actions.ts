"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { crearItemZoho, actualizarItemZoho, buildZohoItemName, buildZohoProductType } from "@/lib/zoho-books";

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
  const PAGE_SIZE = Math.max(5, (sucursalCfg as any)?.items_por_pagina ?? 20);
  return { supabase, userId: user.id, PAGE_SIZE, ...perfil };
}

export type CategoriaProducto = "aro_economico" | "aro_marca" | "aro_sol" | "accesorio" | "servicio" | "lente" | "tratamiento";

export interface Producto {
  id: string;
  categoria: CategoriaProducto;
  nombre: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  precio: number;
  precio_costo: number;
  maneja_stock: boolean;
  stock: number;
  activo: boolean;
  created_at: string;
}

export async function obtenerProductos(
  categoriaSeleccionada?: string,
  searchTerm?: string,
  page: number = 1,
  pageSize?: number
): Promise<{ productos: Producto[]; total: number; pageSize: number }> {
  const { supabase, tenant_id, sucursal_id, PAGE_SIZE } = await getUserContext();
  const effectivePageSize = pageSize ?? PAGE_SIZE;

  let query = supabase
    .from("productos")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenant_id)
    .eq("activo", true)
    .or(`sucursal_id.eq.${sucursal_id},sucursal_id.is.null`);

  if (categoriaSeleccionada && categoriaSeleccionada !== "todo") {
    query = query.eq("categoria", categoriaSeleccionada);
  }

  if (searchTerm) {
    const safe = searchTerm.trim().replace(/[%_\\]/g, "\\$&");
    query = query.or(`nombre.ilike.%${safe}%,marca.ilike.%${safe}%,modelo.ilike.%${safe}%`);
  }

  const from = (page - 1) * effectivePageSize;
  const to = from + effectivePageSize - 1;

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) {
    console.error("Error fetching products:", error);
    return { productos: [], total: 0, pageSize: effectivePageSize };
  }
  return { productos: data || [], total: count || 0, pageSize: effectivePageSize };
}

export async function ajustarStock(id: string, nuevoStock: number) {
  const { supabase, tenant_id } = await getUserContext();

  const { error } = await supabase
    .from("productos")
    .update({ 
      stock: nuevoStock,
      updated_at: new Date().toISOString() 
    })
    .eq("id", id)
    .eq("tenant_id", tenant_id);

  if (error) {
    console.error("Error adjusting stock:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/inventario");
  return { success: true };
}

export async function upsertProducto(payload: Partial<Producto>) {
  const { supabase, tenant_id, sucursal_id } = await getUserContext();

  const isNew = !payload.id;
  const esProductoFisico = payload.maneja_stock ||
    (payload.categoria && ["aro_economico", "aro_marca", "aro_sol", "accesorio", "lente"].includes(payload.categoria));

  // Campos comunes para INSERT y UPDATE
  const camposBase = {
    categoria: payload.categoria,
    nombre: payload.nombre || null,
    marca: payload.marca || null,
    modelo: payload.modelo || null,
    color: payload.color || null,
    precio: payload.precio || 0,
    precio_costo: payload.precio_costo || 0,
    maneja_stock: payload.maneja_stock || false,
    stock: payload.stock || 0,
    updated_at: new Date().toISOString(),
  };

  let productoId: string | null = payload.id ?? null;
  let errorInfo = null;

  if (isNew) {
    // Al crear: asignar sucursal_id según tipo de producto
    const { data: nuevo, error } = await supabase.from("productos").insert({
      ...camposBase,
      tenant_id,
      sucursal_id: esProductoFisico ? sucursal_id : null,
    }).select("id").single();
    errorInfo = error;
    productoId = nuevo?.id ?? null;
  } else {
    // Al editar: NO tocar sucursal_id para no reasignar el producto entre sucursales
    const { error } = await supabase.from("productos")
      .update(camposBase)
      .eq("id", payload.id)
      .eq("tenant_id", tenant_id);
    errorInfo = error;
  }

  if (errorInfo) {
    console.error("Error upserting product:", errorInfo);
    return { success: false, error: errorInfo.message };
  }

  // Zoho Books — sincronizar ítem (best-effort)
  if (productoId && payload.categoria) {
    try {
      const itemName = buildZohoItemName({
        categoria: payload.categoria,
        nombre: payload.nombre ?? null,
        marca: payload.marca ?? null,
        modelo: payload.modelo ?? null,
        color: payload.color ?? null,
      });
      const productType = buildZohoProductType(payload.categoria);

      if (isNew) {
        const zohoItemId = await crearItemZoho({
          name: itemName,
          rate: payload.precio ?? 0,
          product_type: productType,
        });
        await supabase.from("productos").update({ zoho_item_id: zohoItemId }).eq("id", productoId);
      } else {
        // Editar: solo actualizar si tiene zoho_item_id
        const { data: prod } = await supabase
          .from("productos")
          .select("zoho_item_id")
          .eq("id", productoId)
          .single();

        if (prod?.zoho_item_id) {
          await actualizarItemZoho(prod.zoho_item_id as string, {
            name: itemName,
            rate: payload.precio ?? 0,
          });
        } else {
          // Producto existente sin Zoho ID — crearlo ahora
          const zohoItemId = await crearItemZoho({
            name: itemName,
            rate: payload.precio ?? 0,
            product_type: productType,
          });
          await supabase.from("productos").update({ zoho_item_id: zohoItemId }).eq("id", productoId);
        }
      }
    } catch (e) {
      console.error("Zoho sync error (upsertProducto):", e);
    }
  }

  revalidatePath("/dashboard/inventario");
  revalidatePath("/dashboard/ventas/nueva");
  return { success: true };
}

export async function softDeleteProducto(id: string) {
  const { supabase, tenant_id } = await getUserContext();

  const { error } = await supabase
    .from("productos")
    .update({ 
      activo: false, 
      updated_at: new Date().toISOString() 
    })
    .eq("id", id)
    .eq("tenant_id", tenant_id);

  if (error) {
    console.error("Error deleting product:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/inventario");
  revalidatePath("/dashboard/ventas/nueva");
  return { success: true };
}
