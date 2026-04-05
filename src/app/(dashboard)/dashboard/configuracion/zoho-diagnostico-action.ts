"use server";

import { getZohoAccessToken, zohoHeaders, ZOHO_BASE, ZOHO_ORG } from "@/lib/zoho-auth";

export async function probarConexionZoho(): Promise<{ ok: boolean; mensaje: string; detalle?: string }> {
  try {
    // Paso 1: obtener token
    let token: string;
    try {
      token = await getZohoAccessToken();
    } catch (e: unknown) {
      return { ok: false, mensaje: "Falló el token refresh", detalle: e instanceof Error ? e.message : String(e) };
    }

    // Paso 2: llamar endpoint simple (listar 1 contacto)
    const url = `${ZOHO_BASE}/contacts?per_page=1&organization_id=${ZOHO_ORG}`;
    const res = await fetch(url, { headers: zohoHeaders(token), cache: "no-store" });
    const data = await res.json();

    if (data.code !== 0 && data.code !== undefined) {
      return { ok: false, mensaje: `Zoho devolvió código ${data.code}`, detalle: data.message };
    }

    return { ok: true, mensaje: `Conexión exitosa · org ${ZOHO_ORG} · ${data.contacts?.length ?? 0} contacto(s)` };
  } catch (e: unknown) {
    return { ok: false, mensaje: "Error inesperado", detalle: e instanceof Error ? e.message : String(e) };
  }
}
