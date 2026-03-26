"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    return redirect("/login?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Registro de nueva empresa (onboarding multi-tenant).
 * Crea atomicamente: empresa → sucursal principal → auth user → perfil usuario.
 * Rollback completo si algún paso falla.
 */
export async function signup(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const nombre = (formData.get("nombre") as string)?.trim();
  const empresa_nombre = (formData.get("empresa_nombre") as string)?.trim();
  const sucursal_nombre = (formData.get("sucursal_nombre") as string)?.trim();

  if (!email || !password || !nombre || !empresa_nombre || !sucursal_nombre) {
    return redirect("/registro?error=" + encodeURIComponent("Todos los campos son requeridos"));
  }
  if (password.length < 8) {
    return redirect("/registro?error=" + encodeURIComponent("La contraseña debe tener al menos 8 caracteres"));
  }

  const admin = createAdminClient();
  let empresaId: string | null = null;
  let sucursalId: string | null = null;
  let authUserId: string | null = null;

  try {
    // 1. Crear empresa (tenant)
    const { data: empresa, error: e1 } = await admin
      .from("empresas")
      .insert({ nombre: empresa_nombre })
      .select("id")
      .single();
    if (e1 || !empresa) throw new Error("No se pudo crear la empresa");
    empresaId = empresa.id;

    // 2. Crear sucursal principal
    const { data: sucursal, error: e2 } = await admin
      .from("sucursales")
      .insert({ nombre: sucursal_nombre, tenant_id: empresaId, activa: true, campanas_activas: false })
      .select("id")
      .single();
    if (e2 || !sucursal) throw new Error("No se pudo crear la sucursal");
    sucursalId = sucursal.id;

    // 3. Crear usuario en Supabase Auth (email auto-confirmado)
    const { data: authData, error: e3 } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, tenant_id: empresaId, sucursal_id: sucursalId, rol: "administrador" },
    });
    if (e3 || !authData.user) throw new Error(e3?.message ?? "No se pudo crear la cuenta de acceso");
    authUserId = authData.user.id;

    // 4. Crear perfil en tabla usuarios (upsert por si existe trigger en DB)
    const { error: e4 } = await admin
      .from("usuarios")
      .upsert(
        { id: authUserId, nombre, tenant_id: empresaId, sucursal_id: sucursalId, rol: "administrador" },
        { onConflict: "id" }
      );
    if (e4) throw new Error("No se pudo crear el perfil de usuario");

  } catch (err: unknown) {
    // Rollback en orden inverso para no dejar datos huérfanos
    if (authUserId) await admin.auth.admin.deleteUser(authUserId).catch(() => null);
    if (sucursalId) await admin.from("sucursales").delete().eq("id", sucursalId);
    if (empresaId) await admin.from("empresas").delete().eq("id", empresaId);

    const msg = err instanceof Error ? err.message : "Error inesperado al crear la cuenta";
    return redirect("/registro?error=" + encodeURIComponent(msg));
  }

  // 5. Iniciar sesión automáticamente
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return redirect("/login?error=" + encodeURIComponent("Cuenta creada. Inicia sesión para continuar."));
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
