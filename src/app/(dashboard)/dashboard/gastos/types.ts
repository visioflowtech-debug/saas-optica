// Sin categorías predeterminadas del sistema — solo se usan las personalizadas del tenant
export const CATEGORIAS_GASTO: { value: string; label: string }[] = [];

export type CategoriaGasto = string; // incluye predeterminadas + personalizadas del tenant

export interface Gasto {
  id: string;
  concepto: string;
  categoria: CategoriaGasto;
  monto: number;
  fecha: string;
  notas: string | null;
  campana_id: string | null;
  campana?: { nombre: string } | null;
  registrado_por?: string | null;
  created_at: string;
}
