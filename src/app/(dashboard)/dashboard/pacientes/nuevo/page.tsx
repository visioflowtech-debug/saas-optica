import { crearPaciente } from "../actions";
import Link from "next/link";

const ETIQUETAS_COMUNES = [
  "Diabetes", "Hipertensión", "Glaucoma", "Cataratas",
  "Astigmatismo", "Miopía", "Hipermetropía", "Presbicia",
  "Retinopatía", "Ojo seco",
];

export default async function NuevoPacientePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/dashboard/pacientes" className="inline-flex items-center gap-1 text-sm text-t-muted hover:text-t-primary transition">
        ← Volver a pacientes
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-t-primary">Nuevo Paciente</h1>
        <p className="text-t-muted text-sm mt-1">Registrar un nuevo paciente en tu sucursal</p>
      </div>

      {params.error && (
        <div className="p-3 bg-a-red-bg border border-a-red-border rounded-lg text-t-red text-sm">{params.error}</div>
      )}

      <form className="space-y-6 p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-t-secondary mb-1.5">Nombre completo *</label>
          <input id="nombre" name="nombre" type="text" required placeholder="Nombre del paciente"
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="telefono" className="block text-sm font-medium text-t-secondary mb-1.5">Teléfono</label>
            <input id="telefono" name="telefono" type="tel" placeholder="+503 7890-1234"
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-t-secondary mb-1.5">Correo electrónico</label>
            <input id="email" name="email" type="email" placeholder="paciente@email.com"
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="fecha_nacimiento" className="block text-sm font-medium text-t-secondary mb-1.5">Fecha de nacimiento</label>
            <input id="fecha_nacimiento" name="fecha_nacimiento" type="date"
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
          <div>
            <label htmlFor="profesion" className="block text-sm font-medium text-t-secondary mb-1.5">Profesión</label>
            <input id="profesion" name="profesion" type="text" placeholder="Ej: Contador, Ingeniero..."
              className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-t-secondary mb-1.5">Etiquetas médicas</label>
          <input name="etiquetas_medicas" type="text" placeholder="Diabetes, Miopía, Hipertensión..."
            className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {ETIQUETAS_COMUNES.map((tag) => (
              <button key={tag} type="button"
                className="px-2.5 py-1 text-[11px] font-medium bg-badge text-t-secondary border border-b-default rounded-full hover:bg-card-hover hover:text-t-primary transition cursor-pointer">
                + {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input id="acepta_marketing" name="acepta_marketing" type="checkbox"
            className="w-4 h-4 rounded border-b-default bg-input text-blue-600 focus:ring-blue-500 focus:ring-offset-0" />
          <label htmlFor="acepta_marketing" className="text-sm text-t-secondary">
            El paciente acepta recibir comunicaciones de marketing
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button formAction={crearPaciente}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/25">
            Guardar paciente
          </button>
          <Link href="/dashboard/pacientes"
            className="px-6 py-2.5 bg-card border border-b-default text-t-secondary hover:text-t-primary rounded-lg transition-colors">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
