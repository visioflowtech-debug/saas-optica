"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function getUserContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("tenant_id, sucursal_id, rol")
    .eq("id", user.id)
    .single();

  if (!perfil) throw new Error("Perfil no encontrado");
  return { supabase, userId: user.id, ...perfil };
}

export async function crearExamen(formData: FormData) {
  const { supabase, userId, tenant_id, sucursal_id } = await getUserContext();

  const paciente_id = formData.get("paciente_id") as string;
  const campana_id = (formData.get("campana_id") as string) || null;
  const crearVenta = (formData.get("crear_venta") as string) === "1";
  if (!paciente_id) {
    return redirect("/dashboard/examenes/nuevo?error=Selecciona+un+paciente");
  }

  const parseNum = (key: string) => {
    const val = formData.get(key) as string;
    return val !== "" && val !== null ? parseFloat(val) : null;
  };
  const parseStr = (key: string) => {
    const val = formData.get(key) as string;
    return val?.trim() || null;
  };

  const { data: nuevoExamen, error } = await supabase.from("examenes_clinicos").insert({
    tenant_id,
    sucursal_id,
    paciente_id,
    campana_id,
    optometrista_id: userId,
    optometrista_nombre: parseStr("optometrista_nombre"),
    fecha_examen: new Date().toISOString(),
    // Extra fields
    motivo_consulta: parseStr("motivo_consulta"),
    lente_uso: parseStr("lente_uso"),
    av_od_sin_lentes: parseStr("av_od_sin_lentes"),
    av_oi_sin_lentes: parseStr("av_oi_sin_lentes"),
    av_od_cc: parseStr("av_od_cc"),
    av_oi_cc: parseStr("av_oi_cc"),
    pio_od: parseNum("pio_od"),
    pio_oi: parseNum("pio_oi"),
    dp: parseNum("dp"),
    dp_oi: parseNum("dp_oi"),
    dp_unico: parseStr("dp_unico"),
    altura: parseNum("altura"),
    observaciones: parseStr("observaciones"),
    // Refracción Actual (RA)
    ra_od_esfera: parseNum("ra_od_esfera"),
    ra_od_cilindro: parseNum("ra_od_cilindro"),
    ra_od_eje: parseNum("ra_od_eje"),
    ra_od_adicion: parseNum("ra_od_adicion"),
    ra_oi_esfera: parseNum("ra_oi_esfera"),
    ra_oi_cilindro: parseNum("ra_oi_cilindro"),
    ra_oi_eje: parseNum("ra_oi_eje"),
    ra_oi_adicion: parseNum("ra_oi_adicion"),
    // Refracción Final (RF)
    rf_od_esfera: parseNum("rf_od_esfera"),
    rf_od_cilindro: parseNum("rf_od_cilindro"),
    rf_od_eje: parseNum("rf_od_eje"),
    rf_od_adicion: parseNum("rf_od_adicion"),
    rf_oi_esfera: parseNum("rf_oi_esfera"),
    rf_oi_cilindro: parseNum("rf_oi_cilindro"),
    rf_oi_eje: parseNum("rf_oi_eje"),
    rf_oi_adicion: parseNum("rf_oi_adicion"),
  }).select("id").single();

  if (error) {
    console.error("[crearExamen]", error);
    return redirect("/dashboard/examenes/nuevo?error=Error+al+guardar+el+examen.+Intenta+de+nuevo.");
  }

  revalidatePath("/dashboard/examenes");
  revalidatePath(`/dashboard/pacientes/${paciente_id}`);
  if (campana_id) revalidatePath(`/dashboard/campanas/${campana_id}`);

  if (crearVenta) {
    const params = new URLSearchParams({ paciente_id });
    if (campana_id) params.set("campana_id", campana_id);
    if (nuevoExamen?.id) params.set("examen_id", nuevoExamen.id);
    redirect(`/dashboard/ventas/nueva?${params.toString()}`);
  }
  redirect(campana_id ? `/dashboard/campanas/${campana_id}` : "/dashboard/examenes");
}

export async function obtenerDatosReceta(examenId: string) {
  const { supabase, tenant_id, sucursal_id } = await getUserContext();

  // Fetch exam with patient info
  const { data: examen } = await supabase
    .from("examenes_clinicos")
    .select("*, paciente:pacientes!examenes_clinicos_paciente_id_fkey(nombre, telefono, email), optometrista:usuarios!examenes_clinicos_optometrista_id_fkey(nombre)")
    .eq("id", examenId)
    .eq("tenant_id", tenant_id)
    .single();

  if (!examen) return null;

  // Fetch business info + numero_junta del optometrista (by nombre)
  const [empresaRes, sucursalRes, juntaRes] = await Promise.all([
    supabase.from("empresas").select("nombre, nit, logo_url, email").eq("id", tenant_id).single(),
    supabase.from("sucursales").select("nombre, direccion, telefono").eq("id", sucursal_id).single(),
    examen.optometrista_nombre
      ? supabase.from("categorias_config")
          .select("descripcion")
          .eq("tenant_id", tenant_id)
          .eq("modulo", "optometristas")
          .eq("label", examen.optometrista_nombre)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const numero_junta = (juntaRes.data as { descripcion: string | null } | null)?.descripcion ?? null;

  return { examen, empresa: empresaRes.data, sucursal: sucursalRes.data, numero_junta };
}

export async function obtenerUltimaRefraccion(pacienteId: string) {
  const { supabase, tenant_id } = await getUserContext();

  const { data } = await supabase
    .from("examenes_clinicos")
    .select(
      "rf_od_esfera, rf_od_cilindro, rf_od_eje, rf_od_adicion, rf_oi_esfera, rf_oi_cilindro, rf_oi_eje, rf_oi_adicion, lente_uso, dp, dp_oi, altura"
    )
    .eq("paciente_id", pacienteId)
    .eq("tenant_id", tenant_id)
    .order("fecha_examen", { ascending: false })
    .limit(1)
    .single();

  return data;
}

/* ── Anular Examen ──────────────────────────────────────── */
export async function anularExamen(examenId: string) {
  const { supabase, tenant_id, rol } = await getUserContext();
  if (!["administrador", "optometrista"].includes(rol)) throw new Error("Sin permisos para anular exámenes");

  const { data: examen } = await supabase
    .from("examenes_clinicos")
    .select("paciente_id")
    .eq("id", examenId)
    .eq("tenant_id", tenant_id)
    .single();

  if (!examen) throw new Error("Examen no encontrado");

  const { error } = await supabase
    .from("examenes_clinicos")
    .update({ anulado: true })
    .eq("id", examenId)
    .eq("tenant_id", tenant_id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/examenes");
  revalidatePath(`/dashboard/pacientes/${examen.paciente_id}`);
}
