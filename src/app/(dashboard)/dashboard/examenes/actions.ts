"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

  // Parsear módulos opcionales (JSON desde hidden inputs)
  const parseJsonField = (key: string) => {
    const raw = (formData.get(key) as string)?.trim();
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };

  const { data: nuevoExamen, error } = await supabase.from("examenes_clinicos").insert({
    tenant_id,
    sucursal_id,
    paciente_id,
    campana_id,
    optometrista_id: userId,
    optometrista_nombre: parseStr("optometrista_nombre"),
    fecha_examen: new Date().toISOString(),
    // Datos base
    motivo_consulta: parseStr("motivo_consulta"),
    etiquetas_medicas: parseStr("etiquetas_medicas"),
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
    // Plan y recomendaciones
    lente_material: parseStr("lente_material"),
    lente_color: parseStr("lente_color"),
    plan_educacional: parseStr("plan_educacional"),
    control_proxima: parseStr("control_proxima"),
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
    // Módulos opcionales (jsonb — null si no se completaron)
    anamnesis_ext:       parseJsonField("anamnesis_ext"),
    exploracion_externa: parseJsonField("exploracion_externa"),
    binocularidad:       parseJsonField("binocularidad"),
    proceso_refractivo:  parseJsonField("proceso_refractivo"),
  }).select("id").single();

  if (error) {
    console.error("[crearExamen]", error);
    return redirect("/dashboard/examenes/nuevo?error=Error+al+guardar+el+examen.+Intenta+de+nuevo.");
  }

  // Actualizar fecha de modificación del paciente para que aparezca en "recientes"
  await supabase
    .from("pacientes")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", paciente_id)
    .eq("tenant_id", tenant_id);

  revalidatePath("/dashboard/examenes");
  revalidatePath(`/dashboard/pacientes/${paciente_id}`);
  revalidatePath("/dashboard/pacientes");
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
    supabase.from("empresas").select("nombre, nit, logo_data, email").eq("id", tenant_id).single(),
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
  const empresa = empresaRes.data;

  // Usar optometrista_nombre (elegido en el formulario) en lugar del usuario conectado
  const examenConOpt = {
    ...examen,
    optometrista: examen.optometrista_nombre
      ? { nombre: examen.optometrista_nombre }
      : examen.optometrista,
  };

  return { examen: examenConOpt, empresa, sucursal: sucursalRes.data, numero_junta };
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

/* ── Generar Informe IA ─────────────────────────────────── */
export async function generarInformeIA(examenId: string): Promise<{ informe: string } | { error: string }> {
  const { supabase, tenant_id } = await getUserContext();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: "GEMINI_API_KEY no configurada en el servidor." };

  // Fetch exam + patient
  const { data: examen } = await supabase
    .from("examenes_clinicos")
    .select("*, paciente:pacientes!examenes_clinicos_paciente_id_fkey(nombre, fecha_nacimiento, edad), anamnesis_ext, exploracion_externa, binocularidad, proceso_refractivo, lente_material, lente_color, plan_educacional, control_proxima")
    .eq("id", examenId)
    .eq("tenant_id", tenant_id)
    .single();

  if (!examen) return { error: "Examen no encontrado." };

  const fmtNum = (v: number | null) => v != null ? (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)) : "—";
  const fmtAdd = (v: number | null) => (v == null || v === 0) ? "SIN ADICIÓN" : (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
  const paciente = examen.paciente as { nombre: string; fecha_nacimiento: string | null; edad: number | null } | null;

  // Calcular edad exacta (ajustando por mes/día)
  let edadTexto = "desconocida";
  if (paciente?.fecha_nacimiento) {
    const hoy = new Date();
    const nac = new Date(paciente.fecha_nacimiento);
    let edadCalc = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edadCalc--;
    edadTexto = `${edadCalc} años`;
  } else if (paciente?.edad != null) {
    edadTexto = `${paciente.edad} años`;
  }

  // ── Hechos clínicos calculados de forma determinística ──
  // La IA solo redacta alrededor de estas conclusiones; no clasifica por su cuenta.
  const clasificarOjo = (esf: number | null, cil: number | null, add: number | null): string => {
    if (esf == null && cil == null && add == null) return "Sin datos de refracción final registrados";
    const partes: string[] = [];
    if (esf != null && esf < 0) partes.push("Miopía");
    if (esf != null && esf > 0) partes.push("Hipermetropía");
    if (cil != null && cil !== 0) partes.push("Astigmatismo");
    if (add != null && add > 0) partes.push("Presbicia");
    return partes.length > 0 ? partes.join(" + ") : "Emetropía (sin ametropía significativa)";
  };

  const estadoPIO = (v: number | null): string => {
    if (v == null) return "no registrada";
    if (v < 10) return `${v} mmHg — POR DEBAJO del rango normal (10–21 mmHg)`;
    if (v > 21) return `${v} mmHg — ELEVADA respecto al rango normal (10–21 mmHg)`;
    return `${v} mmHg — dentro del rango normal (10–21 mmHg)`;
  };

  const clasifOD = clasificarOjo(examen.rf_od_esfera, examen.rf_od_cilindro, examen.rf_od_adicion);
  const clasifOI = clasificarOjo(examen.rf_oi_esfera, examen.rf_oi_cilindro, examen.rf_oi_adicion);

  const tieneAdicion = (examen.rf_od_adicion ?? 0) > 0 || (examen.rf_oi_adicion ?? 0) > 0;
  const sinRF = examen.rf_od_esfera == null && examen.rf_od_cilindro == null
    && examen.rf_oi_esfera == null && examen.rf_oi_cilindro == null;
  const lenteIndicado = sinRF
    ? "Sin prescripción final registrada — no corresponde indicar lente"
    : tieneAdicion
      ? "Lentes multifocales (bifocales o progresivos) — la prescripción incluye adición"
      : "Lentes monofocales — la prescripción no incluye adición";

  // Cambio de prescripción RA→RF por equivalente esférico (esfera + cilindro/2)
  const eqEsf = (esf: number | null, cil: number | null): number | null =>
    esf == null && cil == null ? null : (esf ?? 0) + (cil ?? 0) / 2;
  const cambioOjo = (raE: number | null, raC: number | null, rfE: number | null, rfC: number | null): string => {
    const ra = eqEsf(raE, raC);
    const rf = eqEsf(rfE, rfC);
    if (ra == null || rf == null) return "no comparable (falta RA o RF)";
    const delta = Math.round((rf - ra) * 100) / 100;
    const signo = delta > 0 ? "+" : "";
    return `Δ ${signo}${delta.toFixed(2)} D en equivalente esférico${Math.abs(delta) >= 0.5 ? " — CAMBIO SIGNIFICATIVO de prescripción" : " — sin cambio significativo"}`;
  };
  const cambioOD = cambioOjo(examen.ra_od_esfera, examen.ra_od_cilindro, examen.rf_od_esfera, examen.rf_od_cilindro);
  const cambioOI = cambioOjo(examen.ra_oi_esfera, examen.ra_oi_cilindro, examen.rf_oi_esfera, examen.rf_oi_cilindro);

  // ── Construir secciones opcionales para el prompt ──
  const truncate = (s: unknown, max = 300) => typeof s === "string" ? s.slice(0, max) : "";
  const an = examen.anamnesis_ext as Record<string, unknown> | null;
  const ex_ext = examen.exploracion_externa as Record<string, { nl: boolean | null; nota: string }> | null;
  const bino = examen.binocularidad as Record<string, string> | null;
  const proc = examen.proceso_refractivo as Record<string, unknown> | null;
  const hxFam = (an && typeof an.hx_familiar === "object" && an.hx_familiar !== null)
    ? an.hx_familiar as Record<string, boolean>
    : { diabetes: false, glaucoma: false, lentes: false, estrabismo: false };

  const seccionAnamnesis = an ? `
ANAMNESIS CLÍNICA (registrada por el optometrista):
  Síntomas presentes: ${Array.isArray(an.sintomas) && (an.sintomas as string[]).length > 0 ? (an.sintomas as string[]).join(", ") : "ninguno registrado"}
  Medicamentos actuales: ${truncate(an.medicamentos) || "no registrados"}
  Tabaquismo: ${an.fuma ? `Sí (${an.cigarrillos_dia ?? "?"} cig/día)` : "No"}
  Consumo de alcohol: ${an.consume_alcohol ? "Sí" : "No"}
  Historia familiar — Diabetes: ${hxFam.diabetes ? "SÍ" : "No"} | Glaucoma: ${hxFam.glaucoma ? "SÍ" : "No"} | Usan lentes: ${hxFam.lentes ? "SÍ" : "No"} | Estrabismo: ${hxFam.estrabismo ? "SÍ" : "No"}` : `
ANAMNESIS CLÍNICA: No registrada en este examen.`;

  const seccionExploracion = ex_ext ? `
EXPLORACIÓN OCULAR EXTERNA:
${Object.entries(ex_ext).map(([seg, val]) => {
    const nombre = { parpados: "Párpados", conjuntiva: "Conjuntiva", cornea: "Córnea", iris: "Iris", cristalino: "Cristalino", reflejo_pupilar: "Reflejo pupilar", mov_oculares: "Movimientos oculares" }[seg] ?? seg;
    if (val.nl === null) return `  ${nombre}: No evaluado`;
    return `  ${nombre}: ${val.nl ? "Normal (NL)" : `Anormal (ANL)${val.nota ? ` — ${val.nota}` : ""}`}`;
  }).join("\n")}` : `
EXPLORACIÓN OCULAR EXTERNA: No registrada en este examen.`;

  const seccionBinocularidad = bino && Object.values(bino).some((v) => v?.trim()) ? `
BINOCULARIDAD Y MOTILIDAD:
  Cover Test — Lejos: ${bino.cover_lejos || "no registrado"}
  Cover Test — 40 cm: ${bino.cover_40cm || "no registrado"}
  Cover Test — 20 cm: ${bino.cover_20cm || "no registrado"}
  Test de Hirshberg: ${bino.hirshberg || "no registrado"}
  Ducciones OD: ${bino.ducciones_od || "no registrado"} | OI: ${bino.ducciones_oi || "no registrado"}
  Versiones: ${bino.versiones || "no registradas"}
  Ojo dominante: ${bino.ojo_dominante || "no registrado"} | Ojo fijador: ${bino.ojo_fijador || "no registrado"}` : `
BINOCULARIDAD Y MOTILIDAD: No registrada en este examen.`;

  const seccionProceso = proc && Object.values(proc).some((v) => String(v ?? "").trim()) ? `
PROCESO REFRACTIVO COMPLETO:
  Retinoscopía objetiva OD: Esf ${proc.retino_od_esfera ?? "—"} / Cil ${proc.retino_od_cilindro ?? "—"} × ${proc.retino_od_eje ?? "—"}°
  Retinoscopía objetiva OI: Esf ${proc.retino_oi_esfera ?? "—"} / Cil ${proc.retino_oi_cilindro ?? "—"} × ${proc.retino_oi_eje ?? "—"}°
  AV sin corrección cerca — OD: ${proc.av_od_sc_cerca ?? "no registrado"} | OI: ${proc.av_oi_sc_cerca ?? "no registrado"}
  AV con corrección cerca — OD: ${proc.av_od_cc_cerca ?? "no registrado"} | OI: ${proc.av_oi_cc_cerca ?? "no registrado"}
  Pinhole — OD: ${proc.pinhole_od ?? "no registrado"} | OI: ${proc.pinhole_oi ?? "no registrado"}
  Prueba subjetiva utilizada: ${proc.prueba_subjetiva ?? "no registrada"}
  Prueba ambulatoria: ${proc.prueba_ambulatoria ?? "no registrada"}
  Toleró la prescripción: ${proc.tolera_prescripcion === "si" ? "Sí" : proc.tolera_prescripcion === "no" ? "No" : "no registrado"}` : `
PROCESO REFRACTIVO COMPLETO: No registrado en este examen.`;

  const seccionPlan = (examen.lente_material || examen.lente_color || examen.plan_educacional || examen.control_proxima) ? `
PLAN Y RECOMENDACIONES DE LENTE:
  Material: ${examen.lente_material ?? "no especificado"}
  Color/tinte: ${examen.lente_color ?? "no especificado"}
  Próximo control: ${examen.control_proxima ?? "no especificado"}
  Plan educacional: ${examen.plan_educacional?.trim() || "ninguno registrado"}` : "";

  const prompt = `Eres un optometrista clínico certificado. Tu tarea es generar un informe clínico estructurado en español, EXCLUSIVAMENTE a partir de los datos del examen registrados a continuación. No inventes, supongas ni extrapoles información que no esté explícitamente presente en los datos.

═══════════════════════════════════════════
DATOS DEL EXAMEN
═══════════════════════════════════════════
PACIENTE: ${paciente?.nombre ?? "Sin nombre"}
EDAD: ${edadTexto}
FECHA DE EXAMEN: ${new Date(examen.fecha_examen).toLocaleDateString("es-SV")}
MOTIVO DE CONSULTA: ${examen.motivo_consulta ?? "No registrado"}
LENTE EN USO PREVIO: ${examen.lente_uso ?? "No registrado"}
${seccionAnamnesis}
${seccionExploracion}
${seccionBinocularidad}
${seccionProceso}

${examen.av_od_sin_lentes || examen.av_oi_sin_lentes || examen.av_od_cc || examen.av_oi_cc ? `
AGUDEZA VISUAL (AV) — escala métrica, distancia 6 metros:
  Sin corrección:  OD ${examen.av_od_sin_lentes ?? "no registrado"}  |  OI ${examen.av_oi_sin_lentes ?? "no registrado"}
  Con corrección:  OD ${examen.av_od_cc ?? "no registrado"}           |  OI ${examen.av_oi_cc ?? "no registrado"}
` : ""}
${examen.pio_od != null || examen.pio_oi != null ? `
PRESIÓN INTRAOCULAR (PIO) — valores normales 10–21 mmHg:
  OD: ${examen.pio_od != null ? `${examen.pio_od} mmHg` : "no registrada"}  |  OI: ${examen.pio_oi != null ? `${examen.pio_oi} mmHg` : "no registrada"}
` : ""}

REFRACCIÓN ACTUAL — lente que el paciente usa actualmente (RA):
  OD: Esf ${fmtNum(examen.ra_od_esfera)} / Cil ${fmtNum(examen.ra_od_cilindro)} × ${examen.ra_od_eje ?? "—"}° / Add ${fmtAdd(examen.ra_od_adicion)}
  OI: Esf ${fmtNum(examen.ra_oi_esfera)} / Cil ${fmtNum(examen.ra_oi_cilindro)} × ${examen.ra_oi_eje ?? "—"}° / Add ${fmtAdd(examen.ra_oi_adicion)}

REFRACCIÓN FINAL — nueva prescripción recomendada (RF):
  OD: Esf ${fmtNum(examen.rf_od_esfera)} / Cil ${fmtNum(examen.rf_od_cilindro)} × ${examen.rf_od_eje ?? "—"}° / Add ${fmtAdd(examen.rf_od_adicion)}
  OI: Esf ${fmtNum(examen.rf_oi_esfera)} / Cil ${fmtNum(examen.rf_oi_cilindro)} × ${examen.rf_oi_eje ?? "—"}° / Add ${fmtAdd(examen.rf_oi_adicion)}

DISTANCIA PUPILAR (DP): ${
  examen.dp_unico || examen.dp != null || examen.dp_oi != null
    ? (examen.dp_unico
        ? examen.dp_unico
        : (examen.dp != null ? `${examen.dp} mm` : "no registrada") + (examen.dp_oi != null ? ` / OI ${examen.dp_oi} mm` : ""))
    : "no registrada"
}
ALTURA DE MONTAJE: ${examen.altura != null ? `${examen.altura} mm` : "no registrada"}
OBSERVACIONES DEL OPTOMETRISTA: ${truncate(examen.observaciones?.trim(), 500) || "Ninguna"}
${seccionPlan}

═══════════════════════════════════════════
HECHOS CLÍNICOS CALCULADOS POR EL SISTEMA (FUENTE DE VERDAD)
═══════════════════════════════════════════
Estas conclusiones fueron calculadas de forma determinística a partir de los datos.
Tu informe DEBE usarlas tal cual — no las recalcules, no las contradigas, no añadas otras.

CLASIFICACIÓN REFRACTIVA OD: ${clasifOD}
CLASIFICACIÓN REFRACTIVA OI: ${clasifOI}
PIO OD: ${estadoPIO(examen.pio_od)}
PIO OI: ${estadoPIO(examen.pio_oi)}
TIPO DE LENTE INDICADO: ${lenteIndicado}
CAMBIO DE PRESCRIPCIÓN OD (RA→RF): ${cambioOD}
CAMBIO DE PRESCRIPCIÓN OI (RA→RF): ${cambioOI}

═══════════════════════════════════════════
REGLAS OBLIGATORIAS (NO NEGOCIABLES)
═══════════════════════════════════════════
1. SOLO interpreta datos presentes. Si un campo dice "no registrado" o "—", indícalo como tal; NO inferas ni supongas su valor.
2. NO escribas ningún valor numérico que no aparezca literalmente en los datos o en los hechos calculados. Prohibido inventar cifras, porcentajes o rangos.
3. El diagnóstico de la sección 3 debe coincidir EXACTAMENTE con la CLASIFICACIÓN REFRACTIVA calculada por el sistema para cada ojo. No añadas ni quites diagnósticos.
4. USA SIEMPRE la escala métrica: agudeza visual en notación de 6 metros (6/6, 6/9, 6/12, etc.), distancias en mm/cm, nunca en pies ni 20/20.
5. No diagnostiques condiciones (glaucoma, catarata, retinopatía, etc.) si no hay datos que las soporten directamente. Una PIO elevada se reporta como "PIO elevada, se recomienda evaluación complementaria" — nunca como diagnóstico de glaucoma.
6. No recomiendes medicamentos, marcas comerciales ni tratamientos quirúrgicos.
7. Sobre la PIO y el cambio de prescripción, usa exactamente el estado indicado en los hechos calculados (valor y comparación con el rango 10–21 mmHg).
8. El tipo de corrección óptica de la sección 4 debe ser el TIPO DE LENTE INDICADO calculado; no propongas otro.
9. El tono debe ser profesional y clínico, comprensible para el paciente sin ser coloquial.
10. NO especules sobre causas no documentadas, antecedentes familiares ni condiciones sistémicas. Los antecedentes familiares registrados en la anamnesis solo pueden mencionarse como factores de riesgo a vigilar, nunca como diagnóstico.

═══════════════════════════════════════════
ESTRUCTURA DEL INFORME (usa exactamente estas secciones)
═══════════════════════════════════════════
**1. Resumen del Caso**
Describe brevemente quién es el paciente, su edad y motivo de consulta. Solo con los datos registrados.

**2. Hallazgos Clínicos**
Interpreta la agudeza visual (con y sin corrección), la refracción y la PIO. Indica si los valores son normales o alterados según los criterios establecidos. Si un dato no fue registrado, dilo explícitamente.

**3. Diagnóstico / Impresión Clínica**
Reproduce la CLASIFICACIÓN REFRACTIVA calculada por el sistema para OD y OI, explicándola en lenguaje claro. Si no hay datos suficientes, indícalo. No añadas diagnósticos adicionales.

**4. Plan y Recomendaciones**
Indica el TIPO DE LENTE INDICADO calculado por el sistema y las recomendaciones de seguimiento basadas solo en los hallazgos presentes. Máximo 4 puntos concretos.

**5. Notas Adicionales**
Incluye únicamente las observaciones registradas por el optometrista. Si no hay observaciones, escribe "Sin observaciones adicionales registradas."
`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      // Temperatura baja: informe clínico determinístico, mínima creatividad
      generationConfig: { temperature: 0.2 },
    });

    const result = await model.generateContent(prompt);
    const informe = result.response.text();
    console.log("[generarInformeIA] ✓ Informe generado:", informe.length, "caracteres");

    // Guardar en la base de datos
    await supabase
      .from("examenes_clinicos")
      .update({ informe_ia: informe, informe_ia_generado_at: new Date().toISOString() })
      .eq("id", examenId)
      .eq("tenant_id", tenant_id);

    revalidatePath(`/dashboard/pacientes`);

    return { informe };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generarInformeIA] ❌ Error capturado:", msg);
    console.error("[generarInformeIA] Tipo de error:", typeof err, err?.constructor?.name);
    if (err instanceof Error && err.cause) {
      console.error("[generarInformeIA] Causa:", err.cause);
    }

    if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests") || msg.includes("RESOURCE_EXHAUSTED")) {
      return { error: "Límite de cuota de Gemini alcanzado. Espera unos minutos e intenta de nuevo." };
    }
    if (msg.includes("API key") || msg.includes("UNAUTHENTICATED") || msg.includes("401")) {
      return { error: "Error de autenticación con Gemini. Verifica la GEMINI_API_KEY en el servidor." };
    }
    if (msg.includes("fetch") || msg.includes("generativelanguage.googleapis.com")) {
      return { error: "Error de conexión con Gemini API. Verifica la conectividad de red y que GEMINI_API_KEY sea válida." };
    }
    return { error: `Error al generar informe: ${msg.substring(0, 150)}` };
  }
}

/* ── Actualizar Examen ─────────────────────────────────── */
export async function actualizarExamen(formData: FormData) {
  const { supabase, tenant_id, sucursal_id } = await getUserContext();

  const examen_id = formData.get("examen_id") as string;
  console.log("[actualizarExamen] examen_id:", examen_id);
  console.log("[actualizarExamen] FormData keys:", Array.from(formData.keys()));
  if (!examen_id) {
    console.error("[actualizarExamen] examen_id no proporcionado");
    return redirect("/dashboard/examenes");
  }

  // Debug: Log FormData completo para verificar form submission
  console.log("[actualizarExamen] FormData keys:", Array.from(formData.keys()));
  console.log("[actualizarExamen] Muestra de valores:");
  console.log("  motivo_consulta:", formData.get("motivo_consulta"));
  console.log("  rf_od_esfera:", formData.get("rf_od_esfera"));
  console.log("  etiquetas_medicas:", formData.get("etiquetas_medicas"));
  const anamnesisVal = formData.get("anamnesis_ext");
  const exploracionVal = formData.get("exploracion_externa");
  console.log("  anamnesis_ext:", typeof anamnesisVal === "string" ? anamnesisVal.substring(0, 50) : "(vacío)");
  console.log("  exploracion_externa:", typeof exploracionVal === "string" ? exploracionVal.substring(0, 50) : "(vacío)");

  // Verificar que el examen existe y pertenece al tenant + sucursal
  const { data: ex } = await supabase
    .from("examenes_clinicos")
    .select("paciente_id, anulado")
    .eq("id", examen_id)
    .eq("tenant_id", tenant_id)
    .eq("sucursal_id", sucursal_id)
    .single();

  if (!ex || ex.anulado) return redirect("/dashboard/examenes");

  const parseNum = (key: string) => {
    const val = formData.get(key) as string;
    return val !== "" && val !== null ? parseFloat(val) : null;
  };
  const parseStr = (key: string) => {
    const val = formData.get(key) as string;
    return val?.trim() || null;
  };
  const parseJsonField = (key: string) => {
    const raw = (formData.get(key) as string)?.trim();
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };

  const { error } = await supabase
    .from("examenes_clinicos")
    .update({
      optometrista_nombre: parseStr("optometrista_nombre"),
      motivo_consulta: parseStr("motivo_consulta"),
      etiquetas_medicas: parseStr("etiquetas_medicas"),
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
      lente_material: parseStr("lente_material"),
      lente_color: parseStr("lente_color"),
      plan_educacional: parseStr("plan_educacional"),
      control_proxima: parseStr("control_proxima"),
      ra_od_esfera: parseNum("ra_od_esfera"),
      ra_od_cilindro: parseNum("ra_od_cilindro"),
      ra_od_eje: parseNum("ra_od_eje"),
      ra_od_adicion: parseNum("ra_od_adicion"),
      ra_oi_esfera: parseNum("ra_oi_esfera"),
      ra_oi_cilindro: parseNum("ra_oi_cilindro"),
      ra_oi_eje: parseNum("ra_oi_eje"),
      ra_oi_adicion: parseNum("ra_oi_adicion"),
      rf_od_esfera: parseNum("rf_od_esfera"),
      rf_od_cilindro: parseNum("rf_od_cilindro"),
      rf_od_eje: parseNum("rf_od_eje"),
      rf_od_adicion: parseNum("rf_od_adicion"),
      rf_oi_esfera: parseNum("rf_oi_esfera"),
      rf_oi_cilindro: parseNum("rf_oi_cilindro"),
      rf_oi_eje: parseNum("rf_oi_eje"),
      rf_oi_adicion: parseNum("rf_oi_adicion"),
      anamnesis_ext: parseJsonField("anamnesis_ext"),
      exploracion_externa: parseJsonField("exploracion_externa"),
      binocularidad: parseJsonField("binocularidad"),
      proceso_refractivo: parseJsonField("proceso_refractivo"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", examen_id)
    .eq("tenant_id", tenant_id)
    .eq("sucursal_id", sucursal_id);

  if (error) {
    console.error("[actualizarExamen] Error en UPDATE:", error);
    return redirect(`/dashboard/examenes/${examen_id}/editar?error=Error+al+guardar`);
  }

  // Actualizar fecha de modificación del paciente para que aparezca en "recientes"
  await supabase
    .from("pacientes")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", ex.paciente_id)
    .eq("tenant_id", tenant_id);

  console.log("[actualizarExamen] ✓ Éxito. Paciente:", ex.paciente_id);
  revalidatePath("/dashboard/examenes");
  revalidatePath(`/dashboard/pacientes/${ex.paciente_id}`);
  revalidatePath("/dashboard/pacientes");
  redirect(`/dashboard/pacientes/${ex.paciente_id}`);
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
