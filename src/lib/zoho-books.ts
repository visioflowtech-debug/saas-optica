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
  sku?: string | null;
}): string {
  const esAro = p.categoria.startsWith("aro");
  if (esAro) {
    // Aros: "ARO" + marca, color, modelo, SKU
    const partes = [p.marca, p.color, p.modelo].filter(Boolean).join(" ");
    const cleaned = partes.trim();
    const skuStr = p.sku ? ` — SKU ${p.sku}` : "";
    return "ARO " + (cleaned || p.categoria) + skuStr;
  }
  if (p.categoria === "accesorio") {
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
  account_name: string; // categoría interna (valor snake_case)
  account_id?: string;  // si se provee, tiene prioridad sobre el mapeo hardcodeado
  date: string; // YYYY-MM-DD
  amount: number;
  description?: string | null;
  reference_number?: string | null;
  paid_through_account_name?: string;
}

// Mapeo valor → account_id real de Zoho Books (exportado del plan de cuentas)
const CATEGORIA_A_ACCOUNT_ID: Record<string, string> = {
  agua:                                      "4863446000001520059",
  alimentacion:                              "4863446000001520003",
  comisiones_bancarias:                      "4863446000000127001",
  compra_de_aros:                            "4863446000000089047",
  compra_de_estuches:                        "4863446000000089053", // Compra de accesorios
  energia_electrica:                         "4863446000001520051",
  gastos_de_alquiler:                        "4863446000000000430",
  gastos_de_ti_y_de_internet:                "4863446000000000427",
  gastos_telefnicos:                         "4863446000000000421",
  impuestos:                                 "4863446000001520043",
  laboratorio_proceso:                       "4863446000001520011",
  papeleria:                                 "4863446000000101089",
  salarios_y_remuneraciones_a_los_empleados: "4863446000000000445",
  // legado
  transporte: "4863446000001520027",
  operativo:  "4863446000001520019",
  otro:       "4863446000001520035",
  hospedaje:  "4863446000000000460",
  publicidad: "4863446000000000403",
};
// Fallback account_id: "Otros gastos" (Expense)
const ZOHO_FALLBACK_ACCOUNT_ID = "4863446000000000460";

export async function registrarGastoZoho(input: ZohoExpenseInput): Promise<string> {
  // Prioridad: account_id explícito (de BD) → mapeo hardcodeado → fallback
  const accountId = input.account_id ?? CATEGORIA_A_ACCOUNT_ID[input.account_name] ?? ZOHO_FALLBACK_ACCOUNT_ID;
  const descripcion = input.description
    ? `[${input.account_name}] ${input.description}`
    : `[${input.account_name}]`;

  const body: Record<string, unknown> = {
    account_id: accountId,
    date: input.date,
    sub_total: input.amount,
    total: input.amount,
    line_items: [{ account_id: accountId, amount: input.amount, description: descripcion }],
  };
  if (input.reference_number) body.reference_number = input.reference_number;
  if (input.paid_through_account_name) body.paid_through_account_name = input.paid_through_account_name;

  const data = await zohoFetch("/expenses", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.expense.expense_id;
}
