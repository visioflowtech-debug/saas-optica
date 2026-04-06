"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
  if (perfil.rol !== "administrador") throw new Error("Sin permisos");
  return { supabase, userId: user.id, ...perfil };
}

export interface CuentaInfo {
  id: string;
  nombre: string;
  tipo: "efectivo" | "banco";
  saldo_actual: number;
  saldo_inicial: number;
}

export interface Movimiento {
  id: string;
  tipo: string;
  monto: number;
  descripcion: string | null;
  referencia_tipo: string | null;
  created_at: string;
}

// ── Obtener cuentas ────────────────────────────────────────
export async function obtenerCuentas(): Promise<CuentaInfo[]> {
  const { supabase, tenant_id, sucursal_id } = await getUserContext();

  const { data } = await supabase
    .from("cuentas")
    .select("id, nombre, tipo, saldo_actual, saldo_inicial")
    .eq("tenant_id", tenant_id)
    .eq("sucursal_id", sucursal_id)
    .order("tipo");

  return (data ?? []) as CuentaInfo[];
}

// ── Configurar saldo inicial (crear o actualizar) ──────────
export async function configurarCuenta(tipo: "efectivo" | "banco", nombre: string, saldoInicial: number) {
  const { supabase, tenant_id, sucursal_id } = await getUserContext();
  if (saldoInicial < 0) return { error: "El saldo inicial no puede ser negativo" };

  // Verificar si ya existe
  const { data: existente } = await supabase
    .from("cuentas")
    .select("id, saldo_actual, saldo_inicial")
    .eq("tenant_id", tenant_id)
    .eq("sucursal_id", sucursal_id)
    .eq("tipo", tipo)
    .maybeSingle();

  if (existente) {
    // Ajustar saldo: nuevo_inicial - anterior_inicial (para mantener coherencia)
    const diff = saldoInicial - Number(existente.saldo_inicial);
    const nuevoSaldo = Number(existente.saldo_actual) + diff;
    const { error } = await supabase
      .from("cuentas")
      .update({ nombre, saldo_inicial: saldoInicial, saldo_actual: nuevoSaldo })
      .eq("id", existente.id);
    if (error) return { error: error.message };
  } else {
    // Crear cuenta nueva con saldo_actual = 0; el trigger lo actualiza via movimiento
    const { data: cuenta, error } = await supabase
      .from("cuentas")
      .insert({ tenant_id, sucursal_id, nombre, tipo, saldo_inicial: saldoInicial, saldo_actual: 0 })
      .select("id")
      .single();
    if (error) return { error: error.message };

    // Registrar movimiento de ajuste inicial si saldo > 0 — el trigger actualiza saldo_actual
    if (saldoInicial > 0 && cuenta) {
      await supabase.from("movimientos_cuenta").insert({
        cuenta_id: cuenta.id,
        tenant_id,
        tipo: "ajuste_inicial",
        monto: saldoInicial,
        descripcion: "Saldo inicial",
        referencia_tipo: "ajuste",
      });
    }
  }

  revalidatePath("/dashboard/cuentas");
  revalidatePath("/dashboard");
  return { success: true };
}

// ── Obtener movimientos de una cuenta ──────────────────────
export async function obtenerMovimientos(
  cuentaId: string,
  pagina: number = 1,
  pageSize: number = 30
): Promise<{ movimientos: Movimiento[]; total: number }> {
  const { supabase, tenant_id } = await getUserContext();

  const from = (pagina - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count } = await supabase
    .from("movimientos_cuenta")
    .select("id, tipo, monto, descripcion, referencia_tipo, created_at", { count: "exact" })
    .eq("cuenta_id", cuentaId)
    .eq("tenant_id", tenant_id)
    .order("created_at", { ascending: false })
    .range(from, to);

  return { movimientos: (data ?? []) as Movimiento[], total: count ?? 0 };
}

// ── Transferencia entre cuentas ────────────────────────────
export async function transferirEntreCuentas(
  cuentaOrigenId: string,
  cuentaDestinoId: string,
  monto: number,
  descripcion?: string
) {
  const { supabase, tenant_id, sucursal_id } = await getUserContext();
  if (monto <= 0) return { error: "El monto debe ser mayor a 0" };
  if (cuentaOrigenId === cuentaDestinoId) return { error: "Las cuentas deben ser diferentes" };

  // Verificar que ambas cuentas pertenecen al tenant Y a la misma sucursal
  const { data: cuentas } = await supabase
    .from("cuentas")
    .select("id, saldo_actual, tipo")
    .eq("tenant_id", tenant_id)
    .eq("sucursal_id", sucursal_id)
    .in("id", [cuentaOrigenId, cuentaDestinoId]);

  if ((cuentas ?? []).length !== 2) return { error: "Cuenta no encontrada" };

  const origen = cuentas!.find((c) => c.id === cuentaOrigenId)!;
  if (Number(origen.saldo_actual) < monto) {
    return { error: `Saldo insuficiente en cuenta origen ($${Number(origen.saldo_actual).toFixed(2)})` };
  }

  // Registrar transferencia
  const { data: transferencia, error: tErr } = await supabase
    .from("transferencias_cuenta")
    .insert({ tenant_id, cuenta_origen_id: cuentaOrigenId, cuenta_destino_id: cuentaDestinoId, monto, descripcion: descripcion ?? null })
    .select("id")
    .single();

  if (tErr) return { error: tErr.message };

  // Movimientos (el trigger actualizará saldo_actual)
  await supabase.from("movimientos_cuenta").insert([
    {
      cuenta_id: cuentaOrigenId,
      tenant_id,
      tipo: "transferencia_out",
      monto,
      descripcion: descripcion ?? "Transferencia",
      referencia_tipo: "transferencia",
      referencia_id: transferencia!.id,
    },
    {
      cuenta_id: cuentaDestinoId,
      tenant_id,
      tipo: "transferencia_in",
      monto,
      descripcion: descripcion ?? "Transferencia",
      referencia_tipo: "transferencia",
      referencia_id: transferencia!.id,
    },
  ]);

  revalidatePath("/dashboard/cuentas");
  revalidatePath("/dashboard");
  return { success: true };
}

// ── KPIs para dashboard ────────────────────────────────────
export async function obtenerResumenCuentas(): Promise<{
  efectivo: number;
  banco: number;
  cxc: number;
  gastosMes: number;
}> {
  const { supabase, tenant_id, sucursal_id } = await getUserContext();

  const { data: cuentas } = await supabase
    .from("cuentas")
    .select("tipo, saldo_actual")
    .eq("tenant_id", tenant_id)
    .eq("sucursal_id", sucursal_id);

  const efectivo = Number((cuentas ?? []).find((c) => c.tipo === "efectivo")?.saldo_actual ?? 0);
  const banco = Number((cuentas ?? []).find((c) => c.tipo === "banco")?.saldo_actual ?? 0);

  // CxC: ordenes confirmadas/facturadas con saldo pendiente
  const { data: cxcData } = await supabase
    .from("v_cuentas_cobrar")
    .select("saldo_pendiente")
    .eq("tenant_id", tenant_id)
    .eq("sucursal_id", sucursal_id)
    .maybeSingle();

  const cxc = Number(cxcData?.saldo_pendiente ?? 0);

  // Gastos del mes actual — usar hora SV (UTC-6) para determinar el mes correcto
  const ahoraSV = new Date(new Date().toLocaleString("en-US", { timeZone: "America/El_Salvador" }));
  const inicioMes = `${ahoraSV.getFullYear()}-${String(ahoraSV.getMonth() + 1).padStart(2, "0")}-01`;
  const { data: gastosData } = await supabase
    .from("gastos")
    .select("monto")
    .eq("tenant_id", tenant_id)
    .eq("sucursal_id", sucursal_id)
    .gte("fecha", inicioMes);

  const gastosMes = (gastosData ?? []).reduce((s, g) => s + Number(g.monto), 0);

  return { efectivo, banco, cxc, gastosMes };
}
