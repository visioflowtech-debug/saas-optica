"use client";

import { useTransition } from "react";
import { cambiarSucursal } from "@/app/(dashboard)/dashboard/configuracion/sucursal-actions";

interface Sucursal {
  id: string;
  nombre: string;
  activa: boolean;
}

interface SucursalSwitcherProps {
  sucursales: Sucursal[];
  sucursalActualId: string;
  sucursalActualNombre: string;
}

export function SucursalSwitcher({
  sucursales,
  sucursalActualId,
  sucursalActualNombre,
}: SucursalSwitcherProps) {
  const [isPending, startTransition] = useTransition();

  if (sucursales.length <= 1) {
    return (
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
        {sucursalActualNombre}
      </p>
    );
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newId = e.target.value;
    if (newId === sucursalActualId) return;
    startTransition(() => {
      cambiarSucursal(newId);
    });
  }

  return (
    <div className="mt-1 relative">
      <select
        value={sucursalActualId}
        onChange={handleChange}
        disabled={isPending}
        className="w-full text-xs rounded px-1.5 py-1 appearance-none pr-5 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
        style={{
          background: "var(--bg-input, #1e293b)",
          color: isPending ? "var(--text-muted)" : "var(--text-secondary)",
          border: "1px solid var(--border-default)",
          cursor: isPending ? "wait" : "pointer",
        }}
        title="Cambiar sucursal"
      >
        {sucursales.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>
      <span
        className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        {isPending ? "⏳" : "▾"}
      </span>
    </div>
  );
}
