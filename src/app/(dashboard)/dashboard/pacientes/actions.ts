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
  if (!perfil) throw new Error(`Perfil no encontrado. User ID: ${user.id}. Error: ${perfilError?.message || "no data"}`);

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

  // Parse medical tags from comma-separated input
  const etiquetasRaw = formData.get("etiquetas_medicas") as string;
  const etiquetas_medicas = etiquetasRaw
    ? etiquetasRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const { data, error } = await supabase
    .from("pacientes")
    .insert({
      tenant_id,
      sucursal_id,
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
    return redirect(
      "/dashboard/pacientes/nuevo?error=" + encodeURIComponent(error.message)
    );
  }

  revalidatePath("/dashboard/pacientes");
  redirect(`/dashboard/pacientes/${data.id}`);
}

export async function actualizarPaciente(formData: FormData) {
  const { supabase } = await getUserContext();

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
    .eq("id", id);

  if (error) {
    return redirect(
      `/dashboard/pacientes/${id}?error=` + encodeURIComponent(error.message)
    );
  }

  revalidatePath(`/dashboard/pacientes/${id}`);
  revalidatePath("/dashboard/pacientes");
  redirect(`/dashboard/pacientes/${id}`);
}

export async function eliminarPaciente(formData: FormData) {
  const { supabase } = await getUserContext();
  const id = formData.get("id") as string;

  const { error } = await supabase.from("pacientes").delete().eq("id", id);

  if (error) {
    return redirect(
      `/dashboard/pacientes?error=` + encodeURIComponent(error.message)
    );
  }

  revalidatePath("/dashboard/pacientes");
  redirect("/dashboard/pacientes");
}
