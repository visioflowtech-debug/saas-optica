"use client";

import Link from "next/link";

const ACCIONES = [
  { href: "/dashboard/pacientes/nuevo", icon: "👤", label: "Nuevo paciente", title: "Crear nuevo paciente" },
  { href: "/dashboard/examenes/nuevo", icon: "🔬", label: "Nuevo examen", title: "Crear nuevo examen" },
  { href: "/dashboard/ventas/nueva", icon: "💰", label: "Nueva venta", title: "Crear nueva venta" },
  { href: "/dashboard/laboratorio", icon: "⚙️", label: "Laboratorio", title: "Acceder a laboratorio" },
];

export default function QuickActionsNav() {
  return (
    <div className="px-4 py-3" style={{ borderTop: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)" }}>
      <p className="text-xs font-medium text-t-muted uppercase tracking-wider mb-2.5 px-1">Acciones</p>
      <div className="grid grid-cols-2 gap-2">
        {ACCIONES.map((accion) => (
          <Link
            key={accion.href}
            href={accion.href}
            title={accion.title}
            className="flex flex-col items-center justify-center py-2.5 rounded-lg border transition-all hover:bg-input"
            style={{ borderColor: "var(--border-default)" }}
          >
            <span className="text-2xl">{accion.icon}</span>
            <span className="text-[10px] text-t-muted mt-1 text-center font-medium">{accion.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
