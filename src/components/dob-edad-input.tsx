"use client";

import { useState } from "react";

function calcularEdad(dob: string): number | null {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

export default function DobEdadInput({
  defaultDob = "",
  defaultEdad = "",
}: {
  defaultDob?: string;
  defaultEdad?: string;
}) {
  const [dob, setDob] = useState(defaultDob);
  const computedAge = calcularEdad(dob);
  // Si hay DOB válido, la edad se calcula automáticamente; si no, el campo es editable
  const edadValue = computedAge !== null ? String(computedAge) : defaultEdad;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label htmlFor="fecha_nacimiento" className="block text-sm font-medium text-t-secondary mb-1.5">
          Fecha de nacimiento
        </label>
        <input
          id="fecha_nacimiento"
          name="fecha_nacimiento"
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
        {computedAge !== null && (
          <p className="text-xs text-t-muted mt-1">{computedAge} años calculados</p>
        )}
      </div>
      <div>
        <label htmlFor="edad" className="block text-sm font-medium text-t-secondary mb-1.5">
          Edad{computedAge !== null ? " (automática)" : " (años)"}
        </label>
        <input
          id="edad"
          name="edad"
          type="number"
          min="0"
          max="120"
          value={edadValue}
          readOnly={computedAge !== null}
          onChange={() => {}}
          placeholder={computedAge !== null ? "" : "Ej: 45"}
          className={`w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
            computedAge !== null ? "opacity-60 cursor-not-allowed" : ""
          }`}
        />
        {computedAge === null && (
          <p className="text-xs text-t-muted mt-1">Usar si no se conoce la fecha de nacimiento</p>
        )}
      </div>
    </div>
  );
}
