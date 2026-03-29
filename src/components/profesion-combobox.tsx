"use client";

import { useState, useTransition } from "react";
import { crearProfesion } from "@/app/(dashboard)/dashboard/pacientes/actions";

export default function ProfesionCombobox({
  profesionesList,
  defaultValue = "",
}: {
  profesionesList: string[];
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [opciones, setOpciones] = useState(profesionesList);
  const [isPending, startTransition] = useTransition();

  const filtradas = opciones.filter((p) =>
    p.toLowerCase().includes(value.toLowerCase())
  );
  const esNueva =
    value.trim() !== "" &&
    !opciones.some((p) => p.toLowerCase() === value.trim().toLowerCase());

  const handleSelect = (p: string) => {
    setValue(p);
    setOpen(false);
  };

  const handleGuardarNueva = () => {
    const val = value.trim();
    if (!val) return;
    startTransition(async () => {
      await crearProfesion(val);
      setOpciones((prev) => [...prev, val].sort((a, b) => a.localeCompare(b)));
    });
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        id="profesion"
        name="profesion"
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Ej: Contador, Ingeniero..."
        autoComplete="off"
        className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
      />

      {open && (filtradas.length > 0 || esNueva) && (
        <div className="absolute z-50 w-full mt-1 bg-sidebar border border-b-default rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.25)] max-h-52 overflow-y-auto">
          {filtradas.map((p) => (
            <button
              key={p}
              type="button"
              onMouseDown={() => handleSelect(p)}
              className="w-full text-left px-3 py-2 text-sm text-t-primary hover:bg-card-hover transition"
            >
              {p}
            </button>
          ))}

          {esNueva && (
            <button
              type="button"
              onMouseDown={handleGuardarNueva}
              disabled={isPending}
              className="w-full text-left px-3 py-2 text-sm text-t-blue hover:bg-card-hover transition border-t border-b-subtle disabled:opacity-50"
            >
              {isPending
                ? "Guardando..."
                : `+ Guardar "${value.trim()}" para futuros pacientes`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
