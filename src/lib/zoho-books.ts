/**
 * Zoho Books API — capa de acceso para contactos, facturas, pagos, gastos e ítems.
 * Todas las funciones son server-only (solo importar desde Server Actions o API routes).
 */

import { getZohoAccessToken, zohoHeaders, ZOHO_BASE, ZOHO_ORG } from "./zoho-auth";

// ── Helpers ──────────────────────────────────────────────

async function zohoFetch(path: string, options: RequestInit = {}) {
  const token = await getZohoAccessToken();
  const separator = path.includes("?") ? "&" : "?";
  const url = `${ZOHO_BASE}${path}${separator}organization_id=${ZOHO_ORG}`;

  const res = await fetch(url, {
    ...options,
    headers: { ...zohoHeaders(token), ...(options.headers ?? {}) },
    cache: "no-store",
  });

  const data = await res.json();
  if (data.code !== 0 && data.code !== undefined) {
    throw new Error(`Zoho API error [${data.code}]: ${data.message}`);
  }
  return data;
}

// ── Contactos (Clientes) ──────────────────────────────────

export interface ZohoContactInput {
  contact_name: string;
  contact_type?: "customer" | "vendor";
  email?: string | null;
  phone?: string | null;
  billing_address?: {
    address?: string | null;
    city?: string | null;
  };
}

export async function buscarContactoZoho(nombre: string): Promise<string | null> {
  try {
    const data = await zohoFetch(`/contacts?contact_name=${encodeURIComponent(nombre)}&contact_type=customer`);
    return data.contacts?.[0]?.contact_id ?? null;
  } catch {
    return null;
  }
}

export async function crearContactoZoho(input: ZohoContactInput): Promise<string> {
  const body: Record<string, unknown> = {
    contact_name: input.contact_name,
    contact_type: input.contact_type ?? "customer",
  };

  // Zoho requiere contact_persons para que aparezca la persona de contacto principal
  const persona: Record<string, unknown> = {
    first_name: input.contact_name,
    is_primary_contact: true,
  };
  if (input.email) persona.email = input.email;
  if (input.phone) persona.mobile = input.phone;
  body.contact_persons = [persona];

  if (input.billing_address?.address) {
    body.billing_address = {
      address: input.billing_address.address,
      city: input.billing_address.city ?? "",
      country: "El Salvador",
    };
  }

  const data = await zohoFetch("/contacts", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.contact.contact_id;
}

export async function obtenerOCrearContactoZoho(input: ZohoContactInput): Promise<string> {
  const existente = await buscarContactoZoho(input.contact_name);
  if (existente) return existente;
  return crearContactoZoho(input);
}

// ── Ítems (Productos) ─────────────────────────────────────

export interface ZohoItemInput {
  name: string;
  rate: number;
  description?: string | null;
  sku?: string | null;
  product_type?: "goods" | "service";
}

/**
 * crearItemZoho / actualizarItemZoho — requieren módulo Items (plan Standard+).
 * Si el plan no lo soporta, lanza error que se captura en best-effort try/catch.
 */
export async function crearItemZoho(input: ZohoItemInput): Promise<string> {
  const body: Record<string, unknown> = {
    name: input.name,
    rate: input.rate,
    product_type: input.product_type ?? "goods",
  };
  if (input.description) body.description = input.description;
  if (input.sku) body.sku = input.sku;

  const data = await zohoFetch("/items", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.item.item_id;
}

export async function actualizarItemZoho(
  itemId: string,
  input: Partial<Pick<ZohoItemInput, "name" | "rate" | "description">>
): Promise<void> {
  await zohoFetch(`/items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** Construye el nombre del ítem igual que el catálogo del SaaS */
export function buildZohoItemName(p: {
  categoria: string;
  nombre: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
}): string {
  const esAroOAccesorio = p.categoria.startsWith("aro") || p.categoria === "accesorio";
  if (esAroOAccesorio) {
    return [p.nombre, p.marca, p.modelo, p.color].filter(Boolean).join(" — ") || p.categoria;
  }
  return p.nombre || p.categoria;
}

/** Mapea categoría del SaaS al product_type de Zoho */
export function buildZohoProductType(categoria: string): "goods" | "service" {
  return ["servicio", "tratamiento"].includes(categoria) ? "service" : "goods";
}

// ── Facturas (Ventas/Invoices) ────────────────────────────

export interface ZohoLineItem {
  name: string;
  description?: string | null;
  rate: number;
  quantity: number;
  item_id?: string | null;
}

export interface ZohoInvoiceInput {
  contact_id: string;
  date: string; // YYYY-MM-DD
  reference_number?: string | null;
  line_items: ZohoLineItem[];
  notes?: string | null;
}

export async function crearFacturaZoho(input: ZohoInvoiceInput): Promise<{ invoice_id: string; invoice_number: string }> {
  const line_items = input.line_items.map((li) => {
    const item: Record<string, unknown> = {
      name: li.name,
      rate: li.rate,
      quantity: li.quantity,
      tax_id: "",      // precios ya incluyen IVA — no aplicar impuesto adicional
    };
    if (li.description) item.description = li.description;
    if (li.item_id) item.item_id = li.item_id;
    return item;
  });

  const body: Record<string, unknown> = {
    customer_id: input.contact_id,
    date: input.date,
    line_items,
  };
  if (input.reference_number) body.reference_number = input.reference_number;
  if (input.notes) body.notes = input.notes;

  const data = await zohoFetch("/invoices", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const invoice_id: string = data.invoice.invoice_id;

  // Marcar como "enviada/confirmada" para que Zoho no la deje en borrador
  try {
    await zohoFetch(`/invoices/${invoice_id}/status/sent`, { method: "POST" });
  } catch { /* si falla no bloqueamos — la factura ya existe */ }

  return {
    invoice_id,
    invoice_number: data.invoice.invoice_number,
  };
}

// ── Pagos (Customer Payments / Abonos) ───────────────────

export type ZohoPaymentMode = "cash" | "check" | "creditcard" | "banktransfer" | "bankremittance" | "autotransaction" | "others";

export interface ZohoPaymentInput {
  contact_id: string;
  invoice_id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  payment_mode: ZohoPaymentMode;
  reference_number?: string | null;
  description?: string | null;
}

export async function registrarPagoZoho(input: ZohoPaymentInput): Promise<string> {
  const body: Record<string, unknown> = {
    customer_id: input.contact_id,
    payment_mode: input.payment_mode,
    amount: input.amount,
    date: input.date,
    invoices: [{ invoice_id: input.invoice_id, amount_applied: input.amount }],
  };
  if (input.reference_number) body.reference_number = input.reference_number;
  if (input.description) body.description = input.description;

  const data = await zohoFetch("/customerpayments", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.payment.payment_id;
}

// ── Gastos (Expenses) ─────────────────────────────────────

export interface ZohoExpenseInput {
  account_name: string; // categoría de gasto
  date: string; // YYYY-MM-DD
  amount: number;
  description?: string | null;
  reference_number?: string | null;
  paid_through_account_name?: string; // cuenta desde donde se pagó
}

// Mapeo valor (snake_case) → nombre exacto de la cuenta en Zoho Books (creadas manualmente)
const CATEGORIA_A_CUENTA_ZOHO: Record<string, string> = {
  agua:                                       "Agua",
  alimentacion:                               "Alimentacion",
  comisiones_bancarias:                       "Comisiones bancarias",
  compra_de_aros:                             "Compra de aros",
  compra_de_estuches:                         "Compra de estuches",
  energia_electrica:                          "Energia electrica",
  gastos_de_alquiler:                         "Gastos de alquiler",
  gastos_de_ti_y_de_internet:                 "Gastos de TI y de Internet",
  gastos_telefnicos:                          "Gastos telefónicos",
  impuestos:                                  "Impuestos",
  laboratorio_proceso:                        "Laboratorio proceso",
  papeleria:                                  "Papeleria",
  salarios_y_remuneraciones_a_los_empleados:  "Salarios y remuneraciones a los empleados",
  // legado — por si existen gastos anteriores con estas categorías del sistema
  transporte:   "Otros gastos",
  hospedaje:    "Otros gastos",
  publicidad:   "Otros gastos",
  operativo:    "Otros gastos",
  otro:         "Otros gastos",
};
// Fallback si la cuenta no está en el mapeo
const ZOHO_EXPENSE_ACCOUNT_FALLBACKS = ["Otros gastos", "Other Expense"];

async function buildExpenseBody(
  account_name: string,
  input: ZohoExpenseInput
): Promise<Record<string, unknown>> {
  const descripcion = input.description
    ? `[${input.account_name}] ${input.description}`
    : `[${input.account_name}]`;
  const body: Record<string, unknown> = {
    account_name,
    date: input.date,
    sub_total: input.amount,
    total: input.amount,
    line_items: [{ account_name, amount: input.amount, description: descripcion }],
  };
  if (input.reference_number) body.reference_number = input.reference_number;
  if (input.paid_through_account_name) body.paid_through_account_name = input.paid_through_account_name;
  return body;
}

export async function registrarGastoZoho(input: ZohoExpenseInput): Promise<string> {
  // Resolver nombre de cuenta: usar el label de Zoho si existe, si no el valor directo
  const cuentaResuelta = CATEGORIA_A_CUENTA_ZOHO[input.account_name] ?? input.account_name;
  const cuentasAIntentar = [cuentaResuelta, ...ZOHO_EXPENSE_ACCOUNT_FALLBACKS];

  for (const cuenta of cuentasAIntentar) {
    try {
      const body = await buildExpenseBody(cuenta, input);
      const data = await zohoFetch("/expenses", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return data.expense.expense_id;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Si el error es de cuenta inválida, probar el siguiente fallback
      if (msg.includes("account") || msg.includes("Account") || msg.includes("3000") || msg.includes("invalid")) {
        continue;
      }
      // Error distinto (auth, red, etc.) — propagar
      throw e;
    }
  }

  throw new Error(`Zoho: no se encontró cuenta de gasto válida. Categorías intentadas: ${cuentasAIntentar.join(", ")}`);
}
