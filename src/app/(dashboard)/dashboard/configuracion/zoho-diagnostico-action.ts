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

export async function probarGastoZoho(): Promise<{ ok: boolean; mensaje: string; detalle?: string }> {
  let token: string;
  try {
    token = await getZohoAccessToken();
  } catch (e) {
    return { ok: false, mensaje: "Error de token", detalle: e instanceof Error ? e.message : String(e) };
  }

  // Intentar obtener cuentas sin filtro de tipo (más permisivo que account_type=expense)
  const url = `${ZOHO_BASE}/chartofaccounts?organization_id=${ZOHO_ORG}&filter_by=AccountType.Expense`;
  try {
    const res = await fetch(url, { headers: zohoHeaders(token), cache: "no-store" });
    const data = await res.json();
    if (data.code === 0 && data.chartofaccounts?.length > 0) {
      const cuentas = data.chartofaccounts.map((c: { account_name: string; account_id: string }) =>
        `${c.account_name}: ${c.account_id}`
      ).join(" | ");
      return { ok: true, mensaje: `Cuentas encontradas (${data.chartofaccounts.length})`, detalle: cuentas };
    }
    if (data.code !== 0) {
      // Fallback: intentar leer gastos existentes para extraer account_id
      const expUrl = `${ZOHO_BASE}/expenses?per_page=10&organization_id=${ZOHO_ORG}`;
      const expRes = await fetch(expUrl, { headers: zohoHeaders(token), cache: "no-store" });
      const expData = await expRes.json();
      if (expData.code === 0 && expData.expenses?.length > 0) {
        // Volcar las claves del primer gasto para identificar el campo correcto
        const primerGasto = expData.expenses[0];
        const claves = Object.keys(primerGasto).join(", ");
        const idCandidatos = ["account_id","expense_account_id","account","account_code","expense_account"]
          .map(k => `${k}=${JSON.stringify(primerGasto[k])}`).join(" | ");
        return { ok: true, mensaje: `Claves del gasto en Zoho`, detalle: `CLAVES: ${claves} || CANDIDATOS: ${idCandidatos}` };
      }
      return { ok: false, mensaje: `Zoho [${data.code}]: ${data.message}`, detalle: "Sin gastos existentes para extraer IDs tampoco" };
    }
    return { ok: false, mensaje: "Sin cuentas retornadas", detalle: JSON.stringify(data) };
  } catch (e) {
    return { ok: false, mensaje: "Error inesperado", detalle: e instanceof Error ? e.message : String(e) };
  }
}

export async function obtenerCuentasGastoZoho(): Promise<{
  ok: boolean;
  cuentas: string[];
  error?: string;
}> {
  let token: string;
  try {
    token = await getZohoAccessToken();
  } catch (e) {
    return { ok: false, cuentas: [], error: e instanceof Error ? e.message : String(e) };
  }
  try {
    const url = `${ZOHO_BASE}/chartofaccounts?account_type=expense&organization_id=${ZOHO_ORG}`;
    const res = await fetch(url, { headers: zohoHeaders(token), cache: "no-store" });
    const data = await res.json();
    if (data.code !== 0 && data.code !== undefined) {
      return { ok: false, cuentas: [], error: `[${data.code}] ${data.message}` };
    }
    const nombres: string[] = (data.chartofaccounts ?? []).map((c: { account_name: string }) => c.account_name);
    return { ok: true, cuentas: nombres };
  } catch (e) {
    return { ok: false, cuentas: [], error: e instanceof Error ? e.message : String(e) };
  }
}

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
