"use client";

import Link from "next/link";

const ACCIONES = [
  { href: "/dashboard/pacientes/nuevo", icon: "👤", label: "Nuevo paciente", title: "Crear nuevo paciente" },
  { href: "/dashboard/examenes/nuevo", icon: "🔬", label: "Nuevo examen", title: "Crear nuevo examen" },
  { href: "/dashboard/ventas/nueva", icon: "💰", label: "Nueva venta", title: "Crear nueva venta" },
  { href: "/dashboard/laboratorio", icon: "⚙️", label: "Laboratorio", title: "Acceder a laboratorio" },
];

export default function QuickActionsNav() {
  // Sección deshabilitada por el momento (user request)
  return null;
}
