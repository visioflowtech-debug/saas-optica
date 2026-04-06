"use server";

import { getZohoAccessToken, zohoHeaders, ZOHO_BASE, ZOHO_ORG } from "@/lib/zoho-auth";

// Categorías de gasto del SaaS con nombre legible para Zoho
const CATEGORIAS_GASTO = [
  { valor: "alimentacion",        label: "Alimentacion" },
  { valor: "compra_de_aros",      label: "Compra de Aros" },
  { valor: "laboratorio_proceso", label: "Laboratorio Proceso" },
  { valor: "operativo",           label: "Operativo" },
  { valor: "transporte",          label: "Transporte" },
  { valor: "otro",                label: "Otro" },
];

export async function sincronizarCuentasGastoZoho(): Promise<{
  creadas: string[];
  existentes: string[];
  errores: string[];
}> {
  const creadas: string[] = [];
  const existentes: string[] = [];
  const errores: string[] = [];

  let token: string;
  try {
    token = await getZohoAccessToken();
  } catch (e) {
    errores.push("No se pudo obtener token: " + (e instanceof Error ? e.message : String(e)));
    return { creadas, existentes, errores };
  }

  // Obtener cuentas de gasto existentes en Zoho
  const listUrl = `${ZOHO_BASE}/chartofaccounts?account_type=expense&organization_id=${ZOHO_ORG}`;
  const listRes = await fetch(listUrl, { headers: zohoHeaders(token), cache: "no-store" });
  const listData = await listRes.json();
  const cuentasExistentes: string[] = (listData.chartofaccounts ?? []).map(
    (c: { account_name: string }) => c.account_name.toLowerCase()
  );

  // Crear las que no existen
  for (const cat of CATEGORIAS_GASTO) {
    if (cuentasExistentes.includes(cat.label.toLowerCase())) {
      existentes.push(cat.label);
      continue;
    }
    try {
      const body = JSON.stringify({ account_name: cat.label, account_type: "expense" });
      const res = await fetch(`${ZOHO_BASE}/chartofaccounts?organization_id=${ZOHO_ORG}`, {
        method: "POST",
        headers: zohoHeaders(token),
        body,
        cache: "no-store",
      });
      const data = await res.json();
      if (data.code !== 0 && data.code !== undefined) {
        errores.push(`${cat.label}: ${data.message}`);
      } else {
        creadas.push(cat.label);
      }
    } catch (e) {
      errores.push(`${cat.label}: ` + (e instanceof Error ? e.message : String(e)));
    }
  }

  return { creadas, existentes, errores };
}

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
