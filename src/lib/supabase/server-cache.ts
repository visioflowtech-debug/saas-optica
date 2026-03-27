import { cache } from "react";
import { createClient } from "./server";

/**
 * Cached per-request auth user.
 * React.cache() deduplicates calls within a single render tree (one HTTP request).
 * Prevents duplicate auth.getUser() network calls across layout, pages, and components.
 */
export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Cached per-request user profile from usuarios table.
 */
export const getCachedPerfil = cache(async () => {
  const user = await getCachedUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: perfil } = await supabase
    .from("usuarios")
    .select("nombre, rol, sucursal_id, tenant_id")
    .eq("id", user.id)
    .single();
  return perfil;
});

/**
 * Cached per-request sucursales list + current branch info.
 * Returns all active branches for the tenant and the user's current branch.
 */
export const getCachedSucursales = cache(async () => {
  const perfil = await getCachedPerfil();
  if (!perfil?.tenant_id) return { todas: [] as { id: string; nombre: string; activa: boolean; campanas_activas: boolean }[], actual: null };
  const supabase = await createClient();
  const { data } = await supabase
    .from("sucursales")
    .select("id, nombre, activa, campanas_activas")
    .eq("tenant_id", perfil.tenant_id)
    .eq("activa", true)
    .order("nombre");
  const todas = (data || []) as { id: string; nombre: string; activa: boolean; campanas_activas: boolean }[];
  const actual = todas.find((s) => s.id === perfil.sucursal_id) ?? null;
  return { todas, actual };
});
