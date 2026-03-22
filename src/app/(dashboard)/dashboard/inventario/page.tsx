import { obtenerProductos } from "./actions";
import InventarioTabs from "./inventario-tabs";

export const metadata = {
  title: "Inventario | SaaS Óptica",
};

export default async function InventarioPage() {
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
