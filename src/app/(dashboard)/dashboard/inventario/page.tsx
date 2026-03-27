import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { puedeAcceder } from "@/lib/acceso";
import { obtenerProductos } from "./actions";
import InventarioTabs from "./inventario-tabs";

export const metadata = {
  title: "Inventario | SaaS Óptica",
};

export default async function InventarioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (!puedeAcceder(perfil?.rol ?? "", "inventario")) redirect("/dashboard");

  const { productos, total } = await obtenerProductos();

  return (
    <div className="p-4 sm:p-8 w-full max-w-7xl mx-auto space-y-6 fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-t-primary">Catálogo e Inventario</h1>
          <p className="text-sm text-t-secondary mt-1">
            Gestiona aros, accesorios, servicios y lentes en un solo lugar.
          </p>
        </div>
      </div>

      <InventarioTabs productosIniciales={productos} totalInicial={total} />
    </div>
  );
}
