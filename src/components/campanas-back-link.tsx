import { getCachedSucursales } from "@/lib/supabase/server-cache";
import Link from "next/link";

export default async function CampanasBackLink() {
  const { actual } = await getCachedSucursales();
  if (!actual?.campanas_activas) return null;

  return (
    <Link
      href="/dashboard/campanas"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-t-secondary hover:text-t-primary border border-b-default bg-card px-3 py-1.5 rounded-lg transition-colors"
    >
      📍 Campañas
    </Link>
  );
}
