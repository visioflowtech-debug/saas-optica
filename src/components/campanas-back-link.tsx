import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function CampanasBackLink() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("sucursal_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.sucursal_id) return null;

  const { data: sucursal } = await supabase
    .from("sucursales")
    .select("campanas_activas")
    .eq("id", perfil.sucursal_id)
    .single();

  if (!sucursal?.campanas_activas) return null;

  return (
    <Link
      href="/dashboard/campanas"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-t-secondary hover:text-t-primary border border-b-default bg-card px-3 py-1.5 rounded-lg transition-colors"
    >
      📍 Campañas
    </Link>
  );
}
