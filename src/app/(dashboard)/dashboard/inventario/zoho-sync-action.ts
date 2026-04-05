"use server";

import { createClient } from "@/lib/supabase/server";
import { crearItemZoho, buildZohoItemName, buildZohoProductType } from "@/lib/zoho-books";

export async function sincronizarProductosZoho(): Promise<{ ok: number; errores: number; mensajesError: string[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("tenant_id, rol")
    .eq("id", user.id)
    .single();
  if (!perfil) throw new Error("Perfil no encontrado");
  if (perfil.rol !== "administrador") throw new Error("Sin permisos");

  const { data: productos } = await supabase
    .from("productos")
    .select("id, categoria, nombre, marca, modelo, color, precio")
    .eq("tenant_id", perfil.tenant_id)
    .eq("activo", true)
    .is("zoho_item_id", null);

  let ok = 0;
  let errores = 0;
  const mensajesError: string[] = [];

  for (const p of productos ?? []) {
    try {
      const itemName = buildZohoItemName(p);
      const zohoItemId = await crearItemZoho({
        name: itemName,
        rate: p.precio,
        product_type: buildZohoProductType(p.categoria),
      });
      await supabase.from("productos").update({ zoho_item_id: zohoItemId }).eq("id", p.id);
      ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      mensajesError.push(`[${p.nombre ?? p.id}] ${msg}`);
      errores++;
    }
  }

  return { ok, errores, mensajesError };
}
