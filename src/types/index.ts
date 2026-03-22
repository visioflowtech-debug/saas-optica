import { Database } from "./database";

// ========================================
// Convenience type aliases
// ========================================

// Row types (what you get from SELECT)
export type Empresa = Database["public"]["Tables"]["empresas"]["Row"];
export type Sucursal = Database["public"]["Tables"]["sucursales"]["Row"];
export type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
export type Paciente = Database["public"]["Tables"]["pacientes"]["Row"];
export type ExamenClinico = Database["public"]["Tables"]["examenes_clinicos"]["Row"];
export type InventarioAro = Database["public"]["Tables"]["inventario_aros"]["Row"];
export type InventarioLente = Database["public"]["Tables"]["inventario_lentes"]["Row"];
export type Tratamiento = Database["public"]["Tables"]["tratamientos"]["Row"];
export type Orden = Database["public"]["Tables"]["ordenes"]["Row"];
export type OrdenDetalle = Database["public"]["Tables"]["orden_detalle"]["Row"];
export type LaboratorioEstado = Database["public"]["Tables"]["laboratorio_estados"]["Row"];
export type WebhookEvent = Database["public"]["Tables"]["webhook_events"]["Row"];

// Insert types (what you send to INSERT)
export type PacienteInsert = Database["public"]["Tables"]["pacientes"]["Insert"];
export type ExamenClinicoInsert = Database["public"]["Tables"]["examenes_clinicos"]["Insert"];
export type OrdenInsert = Database["public"]["Tables"]["ordenes"]["Insert"];
export type OrdenDetalleInsert = Database["public"]["Tables"]["orden_detalle"]["Insert"];

// Update types (what you send to UPDATE)
export type PacienteUpdate = Database["public"]["Tables"]["pacientes"]["Update"];
export type OrdenUpdate = Database["public"]["Tables"]["ordenes"]["Update"];

// Enum types
export type UserRole = Database["public"]["Enums"]["user_role"];
export type OrdenTipo = Database["public"]["Enums"]["orden_tipo"];
export type OrdenEstado = Database["public"]["Enums"]["orden_estado"];
export type LabEstado = Database["public"]["Enums"]["lab_estado"];
export type TipoProducto = Database["public"]["Enums"]["tipo_producto"];

// ========================================
// Composite / View types for UI
// ========================================

/**
 * Patient 360° view — includes demographics + last exam + last order
 */
export interface Paciente360 {
  paciente: Paciente;
  ultimoExamen: ExamenClinico | null;
  ultimaOrden: (Orden & { lab_estado?: LaboratorioEstado }) | null;
  totalExamenes: number;
  totalOrdenes: number;
}

/**
 * Refracción data — used for the clinical form
 */
export interface Refraccion {
  esfera: number | null;
  cilindro: number | null;
  eje: number | null;
  adicion: number | null;
}

/**
 * Examen form data — structured for the UI form
 */
export interface ExamenFormData {
  ra_od: Refraccion;
  ra_oi: Refraccion;
  rf_od: Refraccion;
  rf_oi: Refraccion;
  observaciones: Record<string, unknown>;
}

/**
 * Kanban card for the lab board
 */
export interface KanbanCard {
  orden: Orden;
  paciente: Pick<Paciente, "id" | "nombre" | "telefono">;
  labEstado: LaboratorioEstado;
}

/**
 * Tenant context — available through middleware/hooks
 */
export interface TenantContext {
  tenantId: string;
  sucursalId: string;
  userId: string;
  rol: UserRole;
  nombreEmpresa: string;
  nombreSucursal: string;
}
