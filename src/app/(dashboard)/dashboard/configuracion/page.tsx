import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { puedeAcceder } from "@/lib/acceso";
import ConfiguracionTabs from "./configuracion-tabs";
import { obtenerConfiguracion, obtenerUsuariosTenant } from "./actions";
import { obtenerLaboratorios } from "./laboratorio-actions";
import { obtenerCategoriasGasto } from "./categorias-actions";
import { obtenerOptometristas } from "./optometristas-actions";

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (!puedeAcceder(perfil?.rol ?? "", "configuracion")) redirect("/dashboard");

  const [{ empresa, sucursales, error }, laboratorios, categoriasGasto, { usuarios }, optometristas] = await Promise.all([
    obtenerConfiguracion(),
    obtenerLaboratorios(),
    obtenerCategoriasGasto(),
    obtenerUsuariosTenant(),
    obtenerOptometristas(),
  ]);

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
      <div>
        <h1 className="text-2xl font-bold text-t-primary">Configuración</h1>
        <p className="text-t-secondary text-sm">Administra empresa, sucursales, laboratorios y categorías.</p>
      </div>
      <ConfiguracionTabs
        empresa={empresa}
        sucursales={sucursales}
        laboratorios={laboratorios}
        categoriasGasto={categoriasGasto}
        usuarios={usuarios}
        optometristas={optometristas}
      />
    </div>
  );
}
