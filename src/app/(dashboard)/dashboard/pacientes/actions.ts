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

  const { data: perfil, error: perfilError } = await supabase
    .from("usuarios")
    .select("tenant_id, sucursal_id, rol")
    .eq("id", user.id)
    .single();

  if (perfilError) {
    console.error("Error fetching perfil:", perfilError.message, perfilError.code, perfilError.details);
  }
  if (!perfil) throw new Error("No se pudo cargar el perfil del usuario");

  return { supabase, userId: user.id, ...perfil };
}

export async function crearPaciente(formData: FormData) {
  const { supabase, tenant_id, sucursal_id } = await getUserContext();

  const nombre = formData.get("nombre") as string;
  const telefono = formData.get("telefono") as string;
  const email = formData.get("email") as string;
  const fecha_nacimiento = formData.get("fecha_nacimiento") as string;
  const profesion = formData.get("profesion") as string;
  const acepta_marketing = formData.get("acepta_marketing") === "on";
  const campana_id = (formData.get("campana_id") as string) || null;

  // Si viene de una campaña, usar la sucursal de la campaña (no la del usuario)
  // para evitar que pacientes queden en la sucursal equivocada
  let pacienteSucursalId = sucursal_id;
  if (campana_id) {
    const { data: campana } = await supabase
      .from("campanas")
      .select("sucursal_id")
      .eq("id", campana_id)
      .eq("tenant_id", tenant_id)
      .single();
    if (campana?.sucursal_id) pacienteSucursalId = campana.sucursal_id;
  }

  // Parse medical tags from comma-separated input
  const etiquetasRaw = formData.get("etiquetas_medicas") as string;
  const etiquetas_medicas = etiquetasRaw
    ? etiquetasRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const { data, error } = await supabase
    .from("pacientes")
    .insert({
      tenant_id,
      sucursal_id: pacienteSucursalId,
      nombre,
      telefono: telefono || null,
      email: email || null,
      fecha_nacimiento: fecha_nacimiento || null,
      profesion: profesion || null,
      etiquetas_medicas,
      acepta_marketing,
      campana_id,
    })
    .select("id")
    .single();

  if (error) {
    const base = campana_id
      ? `/dashboard/pacientes/nuevo?campana_id=${campana_id}`
      : "/dashboard/pacientes/nuevo";
    return redirect(base + "&error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/dashboard/pacientes");
  if (campana_id) revalidatePath(`/dashboard/campanas/${campana_id}`);
  // Regresar al contexto de origen
  redirect(campana_id ? `/dashboard/campanas/${campana_id}` : `/dashboard/pacientes/${data.id}`);
}

export async function obtenerProfesiones(): Promise<string[]> {
  const { supabase, tenant_id } = await getUserContext();
  const { data } = await supabase
    .from("categorias_config")
    .select("label")
    .eq("tenant_id", tenant_id)
    .eq("modulo", "profesiones")
    .eq("activo", true)
    .order("label");
  return (data ?? []).map((d) => d.label);
}

export async function crearProfesion(label: string) {
  const { supabase, tenant_id } = await getUserContext();
  const valor = label.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_áéíóúüñ]/g, "");
  if (!label.trim()) return { error: "Nombre inválido" };
  const { error } = await supabase.from("categorias_config").insert({
    tenant_id,
    modulo: "profesiones",
    valor: valor || label.trim().substring(0, 30),
    label: label.trim(),
    activo: true,
  });
  if (error && error.code !== "23505") return { error: error.message };
  revalidatePath("/dashboard/pacientes");
  return { success: true };
}

export async function actualizarPaciente(formData: FormData) {
  const { supabase, tenant_id } = await getUserContext();

  const id = formData.get("id") as string;
  const nombre = formData.get("nombre") as string;
  const telefono = formData.get("telefono") as string;
  const email = formData.get("email") as string;
  const fecha_nacimiento = formData.get("fecha_nacimiento") as string;
  const profesion = formData.get("profesion") as string;
  const acepta_marketing = formData.get("acepta_marketing") === "on";

  const etiquetasRaw = formData.get("etiquetas_medicas") as string;
  const etiquetas_medicas = etiquetasRaw
    ? etiquetasRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const { error } = await supabase
    .from("pacientes")
    .update({
      nombre,
      telefono: telefono || null,
      email: email || null,
      fecha_nacimiento: fecha_nacimiento || null,
      profesion: profesion || null,
      etiquetas_medicas,
      acepta_marketing,
    })
    .eq("id", id)
    .eq("tenant_id", tenant_id);

  if (error) {
    return redirect(`/dashboard/pacientes/${id}?error=Error+al+actualizar+paciente`);
  }

  revalidatePath(`/dashboard/pacientes/${id}`);
  revalidatePath("/dashboard/pacientes");
  redirect(`/dashboard/pacientes/${id}`);
}

export async function eliminarPaciente(formData: FormData) {
  const { supabase, tenant_id } = await getUserContext();
  const id = formData.get("id") as string;

  const { error } = await supabase.from("pacientes").delete().eq("id", id).eq("tenant_id", tenant_id);

  if (error) {
    return redirect(
      `/dashboard/pacientes?error=` + encodeURIComponent(error.message)
    );
  }

  revalidatePath("/dashboard/pacientes");
  redirect("/dashboard/pacientes");
}
