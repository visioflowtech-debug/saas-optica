import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ConfiguracionTabs from "./configuracion-tabs";
import { obtenerConfiguracion } from "./actions";

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { empresa, sucursales, error } = await obtenerConfiguracion();

  if (error || !empresa) {
    return (
      <div className="p-12 text-center text-t-muted">
        <h2 className="text-xl font-bold mb-2">Error de Configuración</h2>
        <p>{error || "No se encontró el perfil de la empresa asociada a tu cuenta."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-t-primary">Configuración</h1>
          <p className="text-t-secondary text-sm">Administra la información de tu empresa y sucursales.</p>
        </div>
      </div>

      <ConfiguracionTabs empresa={empresa} sucursales={sucursales} />
    </div>
  );
}
