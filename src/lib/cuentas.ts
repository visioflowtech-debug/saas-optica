/**
 * Helpers para registrar movimientos en cuentas (Efectivo / Banco).
 * Solo importar desde Server Actions.
 * Fail-soft: si el tenant no tiene cuentas configuradas, no lanza error.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type TipoCuenta = "efectivo" | "banco";
export type TipoMovimiento = "ingreso" | "egreso" | "ajuste_inicial" | "transferencia_in" | "transferencia_out";

interface MovimientoInput {
  supabase: SupabaseClient;
  tenant_id: string;
  sucursal_id: string;
  tipo_cuenta: TipoCuenta;
  tipo_movimiento: TipoMovimiento;
  monto: number;
  descripcion?: string | null;
  referencia_tipo?: "pago" | "gasto" | "transferencia" | "ajuste";
  referencia_id?: string | null;
}

/** Registra un movimiento en la cuenta indicada. No lanza si la cuenta no existe. */
export async function registrarMovimientoCuenta(input: MovimientoInput): Promise<void> {
  const { supabase, tenant_id, sucursal_id, tipo_cuenta, tipo_movimiento, monto, descripcion, referencia_tipo, referencia_id } = input;

  const { data: cuenta } = await supabase
    .from("cuentas")
    .select("id")
    .eq("tenant_id", tenant_id)
    .eq("sucursal_id", sucursal_id)
    .eq("tipo", tipo_cuenta)
    .maybeSingle();

  if (!cuenta) return; // tenant sin cuentas configuradas — skip silencioso

  const { error } = await supabase.from("movimientos_cuenta").insert({
    cuenta_id: cuenta.id,
    tenant_id,
    tipo: tipo_movimiento,
    monto,
    descripcion: descripcion ?? null,
    referencia_tipo: referencia_tipo ?? null,
    referencia_id: referencia_id ?? null,
  });

  if (error) {
    // Log para diagnóstico — no relanzar (fail-soft intencional)
    console.error("[cuentas] Error al insertar movimiento:", error.message, { cuenta_id: cuenta.id, tipo: tipo_movimiento, monto });
  }
}

/** Registra un movimiento usando cuenta_id directamente. Valida ownership (tenant + sucursal). */
export async function registrarMovimientoCuentaPorId(input: {
  supabase: SupabaseClient;
  tenant_id: string;
  sucursal_id: string;
  cuenta_id: string;
  tipo_movimiento: TipoMovimiento;
  monto: number;
  descripcion?: string | null;
  referencia_tipo?: "pago" | "gasto" | "transferencia" | "ajuste" | "ingreso_manual";
  referencia_id?: string | null;
}): Promise<void> {
  const { supabase, tenant_id, sucursal_id, cuenta_id, tipo_movimiento, monto, descripcion, referencia_tipo, referencia_id } = input;

  // Validar ownership: la cuenta debe pertenecer al mismo tenant y sucursal
  const { data: cuenta } = await supabase
    .from("cuentas")
    .select("id")
    .eq("id", cuenta_id)
    .eq("tenant_id", tenant_id)
    .eq("sucursal_id", sucursal_id)
    .maybeSingle();

  if (!cuenta) {
    console.error("[cuentas] Cuenta no encontrada o no pertenece a esta sucursal:", { cuenta_id, tenant_id, sucursal_id });
    return; // fail-soft: no registrar en cuenta ajena
  }

  const { error } = await supabase.from("movimientos_cuenta").insert({
    cuenta_id,
    tenant_id,
    tipo: tipo_movimiento,
    monto,
    descripcion: descripcion ?? null,
    referencia_tipo: referencia_tipo ?? null,
    referencia_id: referencia_id ?? null,
  });

  if (error) {
    console.error("[cuentas] Error al insertar movimiento por id:", error.message, { cuenta_id, tipo: tipo_movimiento, monto });
  }
}

/** Determina la cuenta destino según el método de pago */
export function tipoCuentaDesdeMetodoPago(metodoPago: string): TipoCuenta {
  const m = metodoPago.toLowerCase();
  if (m === "efectivo") return "efectivo";
  return "banco"; // tarjeta, transferencia, deposito, cheque → banco
}
