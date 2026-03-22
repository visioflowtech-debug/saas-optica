// ========================================
// Óptica Nueva Imagen — App Constants
// ========================================

// User Roles (matches DB enum public.user_role)
export const USER_ROLES = {
  ADMINISTRADOR: "administrador",
  OPTOMETRISTA: "optometrista",
  ASESOR_VISUAL: "asesor_visual",
  LABORATORIO: "laboratorio",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ROLE_LABELS: Record<UserRole, string> = {
  administrador: "Administrador",
  optometrista: "Optometrista",
  asesor_visual: "Asesor Visual",
  laboratorio: "Laboratorio",
};

// Order Types (matches DB enum public.orden_tipo)
export const ORDEN_TIPOS = {
  PROFORMA: "proforma",
  ORDEN_TRABAJO: "orden_trabajo",
} as const;

export type OrdenTipo = (typeof ORDEN_TIPOS)[keyof typeof ORDEN_TIPOS];

// Order Status (matches DB enum public.orden_estado)
export const ORDEN_ESTADOS = {
  BORRADOR: "borrador",
  CONFIRMADA: "confirmada",
  FACTURADA: "facturada",
  CANCELADA: "cancelada",
} as const;

export type OrdenEstado = (typeof ORDEN_ESTADOS)[keyof typeof ORDEN_ESTADOS];

export const ORDEN_ESTADO_LABELS: Record<OrdenEstado, string> = {
  borrador: "Borrador",
  confirmada: "Confirmada",
  facturada: "Facturada",
  cancelada: "Cancelada",
};

// Lab Status (matches DB enum public.lab_estado)
export const LAB_ESTADOS = {
  PENDIENTE: "pendiente",
  EN_LABORATORIO: "en_laboratorio",
  RECIBIDO: "recibido",
  ENTREGADO: "entregado",
} as const;

export type LabEstado = (typeof LAB_ESTADOS)[keyof typeof LAB_ESTADOS];

export const LAB_ESTADO_LABELS: Record<LabEstado, string> = {
  pendiente: "Pendiente",
  en_laboratorio: "En Laboratorio",
  recibido: "Recibido",
  entregado: "Entregado",
};

export const LAB_ESTADO_COLORS: Record<LabEstado, string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  en_laboratorio: "bg-blue-100 text-blue-800",
  recibido: "bg-green-100 text-green-800",
  entregado: "bg-emerald-100 text-emerald-800",
};

// Product Types (matches DB enum public.tipo_producto)
export const TIPO_PRODUCTOS = {
  ARO: "aro",
  LENTE: "lente",
  TRATAMIENTO: "tratamiento",
} as const;

export type TipoProducto =
  (typeof TIPO_PRODUCTOS)[keyof typeof TIPO_PRODUCTOS];

// Common external labs
export const LABORATORIOS_EXTERNOS = [
  "LOMED",
  "SERVILENS",
  "INDO",
  "ESSILOR",
  "ZEISS",
  "HOYA",
] as const;

// Common medical tags for patients
export const ETIQUETAS_MEDICAS_COMUNES = [
  "Diabetes",
  "Hipertensión",
  "Glaucoma",
  "Cataratas",
  "Astigmatismo",
  "Miopía",
  "Hipermetropía",
  "Presbicia",
  "Retinopatía",
  "Ojo seco",
] as const;

// Webhook event types
export const WEBHOOK_EVENTS = {
  PACIENTE_CUMPLE: "paciente_cumple_anios",
  EXAMEN_FINALIZADO: "examen_finalizado",
  LENTE_LISTO: "lente_listo_entrega",
  VENTA_CERRADA: "venta_cerrada",
} as const;
